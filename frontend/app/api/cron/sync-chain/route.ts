import { NextRequest, NextResponse } from "next/server";
import { authorizeCron, logJson } from "@/lib/oracle/cronAuth";
import { serviceSupabase } from "@/lib/oracle/supabase";
import { serverPublicClient, serverWorkProofAddress } from "@/lib/server-chain";
import { readAllJobs, readApplicants, statusName, modeName, isAssigned } from "@/lib/workproof-reads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Mirrors authoritative chain state into the Supabase cache and emits
// activity_log + per-user notifications on transitions. This is the
// "indexer without a server" — pinged by GitHub Actions on a schedule.
export async function GET(request: NextRequest) {
  const auth = authorizeCron(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: 401 });

  const contract = serverWorkProofAddress();
  if (!contract) return NextResponse.json({ ok: false, error: "WORKPROOF_CONTRACT missing" }, { status: 503 });

  const supabase = serviceSupabase();
  const pc = serverPublicClient();

  let jobsSynced = 0, appsAdded = 0, claimsAdded = 0, transitions = 0;

  try {
    const chainJobs = await readAllJobs(pc, contract);

    // Prior DB state for transition diffing.
    const { data: priorRows } = await supabase.from("jobs").select("job_id_onchain, status, assigned_to_wallet, description");
    const prior = new Map<string, { status: string; assigned: string | null; description: string | null }>(
      (priorRows ?? []).map((r: any) => [String(r.job_id_onchain).toLowerCase(), { status: r.status, assigned: r.assigned_to_wallet, description: r.description }])
    );

    const activity: any[] = [];
    const notifications: any[] = [];

    for (const j of chainJobs) {
      const id = j.jobId;
      const newStatus = statusName(j.status);
      const assigned = isAssigned(j) ? j.assignedFreelancer : null;
      const prev = prior.get(id.toLowerCase());

      // Upsert the job row from chain-trusted values. We deliberately OMIT
      // `description` so the richer client-provided text is preserved.
      const row: Record<string, unknown> = {
        job_id_onchain: id,
        client_wallet: j.client,
        freelancer_wallet: assigned,
        assigned_to_wallet: assigned,
        title: j.title,
        acceptance_criteria: j.acceptanceCriteria,
        domain: j.domain,
        escrow_amount_wei: j.escrowAmount.toString(),
        reward_amount_wei: j.rewardAmount.toString(),
        status: newStatus,
        retry_count: Number(j.retryCount),
        deliverable_url: j.deliverableUrl || null,
        deadline: new Date(Number(j.deadline) * 1000).toISOString()
      };
      const { error: upErr } = await supabase.from("jobs").upsert(row, { onConflict: "job_id_onchain" });
      if (!upErr) jobsSynced++;

      // Transition detection → activity + notifications.
      if (prev && prev.status !== newStatus) {
        transitions++;
        if (newStatus === "Active" && assigned) {
          activity.push({ event_type: "job_accepted", job_id: id, actor_wallet: j.client, target_wallet: assigned, metadata: { title: j.title } });
          notifications.push({ recipient_wallet: assigned.toLowerCase(), kind: "accepted", job_id: id, payload: { message: `You were accepted for "${j.title}".` } });
        } else if (newStatus === "UnderReview" && assigned) {
          // Work was just submitted — let the client know it's under AI review.
          activity.push({ event_type: "work_submitted", job_id: id, actor_wallet: assigned, target_wallet: j.client, metadata: { title: j.title } });
          notifications.push({ recipient_wallet: j.client.toLowerCase(), kind: "work_submitted", job_id: id, payload: { message: `A freelancer submitted work for "${j.title}" — it's now under AI review.` } });
        } else if (newStatus === "AwaitingApproval" && assigned) {
          // GenLayer passed the work. Notify both sides: the freelancer is waiting
          // on the client, and the client must approve to release the reward.
          activity.push({ event_type: "verdict_pass", job_id: id, actor_wallet: assigned, metadata: { title: j.title } });
          notifications.push({ recipient_wallet: assigned.toLowerCase(), kind: "verdict_pass", job_id: id, payload: { message: `Your work for "${j.title}" passed AI review — waiting on the client to approve and release the reward.` } });
          notifications.push({ recipient_wallet: j.client.toLowerCase(), kind: "approval_needed", job_id: id, payload: { message: `A submission for "${j.title}" passed AI review — approve it to release the reward.` } });
        } else if (newStatus === "Passed" && assigned) {
          activity.push({ event_type: "verdict_pass", job_id: id, actor_wallet: assigned, metadata: { title: j.title } });
          notifications.push({ recipient_wallet: assigned.toLowerCase(), kind: "verdict_pass", job_id: id, payload: { message: `Your work for "${j.title}" passed — claim your reward.` } });
        } else if (newStatus === "Failed" && assigned) {
          activity.push({ event_type: "verdict_fail", job_id: id, actor_wallet: assigned, metadata: { title: j.title, retry: Number(j.retryCount) } });
          notifications.push({ recipient_wallet: assigned.toLowerCase(), kind: "verdict_fail", job_id: id, payload: { message: `Your work for "${j.title}" was rejected. ${3 - Number(j.retryCount)} attempt(s) left.` } });
        } else if (newStatus === "Complete" && assigned) {
          activity.push({ event_type: "reward_claimed", job_id: id, actor_wallet: assigned, metadata: { title: j.title } });
        } else if (newStatus === "Refunded") {
          activity.push({ event_type: "refund_issued", job_id: id, actor_wallet: j.client, metadata: { title: j.title } });
        }
      }

      // Backfill claim_queue for Passed jobs (idempotent).
      if (newStatus === "Passed" && assigned) {
        const { data: existing } = await supabase.from("claim_queue").select("id").eq("job_id_onchain", id).maybeSingle();
        if (!existing) {
          await supabase.from("claim_queue").insert({
            job_id_onchain: id,
            freelancer_wallet: assigned.toLowerCase(),
            reward_wei: j.rewardAmount.toString(),
            status: "pending",
            passed_at: new Date(Number(j.verdictAt) * 1000).toISOString()
          });
          claimsAdded++;
        }
      }

      // Sync applicants for Open application jobs.
      if (j.status === 0 && modeName(j.mode) === "Application") {
        try {
          const applicants = await readApplicants(pc, id, contract);
          if (applicants.length > 0) {
            const { data: existing } = await supabase
              .from("job_applications")
              .select("freelancer_wallet")
              .eq("job_id_onchain", id);
            const known = new Set((existing ?? []).map((r: any) => String(r.freelancer_wallet).toLowerCase()));
            for (const a of applicants) {
              const low = a.toLowerCase();
              if (known.has(low)) continue;
              await supabase.from("job_applications").insert({ job_id_onchain: id, freelancer_wallet: low, status: "pending" });
              appsAdded++;
              activity.push({ event_type: "application_submitted", job_id: id, actor_wallet: low, metadata: { title: j.title } });
              notifications.push({ recipient_wallet: j.client.toLowerCase(), kind: "application", job_id: id, payload: { message: `${low.slice(0, 6)}…${low.slice(-4)} applied to "${j.title}".` } });
            }
          }
        } catch (e) {
          logJson("cron/sync-chain", "warn", "applicants read failed", { jobId: id, error: (e as Error).message });
        }
      }
    }

    if (activity.length) await supabase.from("activity_log").insert(activity);
    if (notifications.length) await supabase.from("notifications").insert(notifications);

    logJson("cron/sync-chain", "info", "synced", { jobsSynced, appsAdded, claimsAdded, transitions });
    return NextResponse.json({ ok: true, jobsSynced, appsAdded, claimsAdded, transitions });
  } catch (e) {
    logJson("cron/sync-chain", "error", "cycle failed", { error: (e as Error).message });
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
