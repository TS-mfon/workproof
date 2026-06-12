import { NextRequest, NextResponse } from "next/server";
import { authorizeCron, logJson } from "@/lib/oracle/cronAuth";
import { serviceSupabase } from "@/lib/oracle/supabase";
import { rpcGenLayer } from "@/lib/oracle/genlayer";
import { relayVerdict } from "@/lib/oracle/relayVerdict";
import { serverPublicClient, serverWorkProofAddress } from "@/lib/server-chain";
import { readAllJobs, readJobSubmissions, readSubmission, statusName } from "@/lib/workproof-reads";
import { eventKey, upsertEvents } from "@/lib/oracle/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = authorizeCron(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: 401 });

  let processed = 0;
  let relayed = 0;
  let notified = 0;
  let failed = 0;

  try {
    const contract = serverWorkProofAddress();
    if (!contract) throw new Error("WORKPROOF_CONTRACT missing");
    const client = serverPublicClient();
    const chainJobs = (await readAllJobs(client, contract)).filter((job) => statusName(job.status) === "UnderReview");

    for (const chainJob of chainJobs) {
      const jobId = chainJob.jobId;
      const ids = await readJobSubmissions(client, jobId, contract);
      for (const submissionId of ids) {
        processed++;
        try {
          const submission = await readSubmission(client, submissionId, contract);
          if (submission.status !== 0) continue;
          const resultEventKey = eventKey("submission-verdict", submissionId, submission.freelancer);
          const { data: alreadyProcessed, error: lookupError } = await serviceSupabase()
            .from("notifications")
            .select("id")
            .eq("event_key", resultEventKey)
            .maybeSingle();
          if (lookupError) throw lookupError;
          if (alreadyProcessed) continue;
          const verdict = (await rpcGenLayer("get_submission_verdict", [`submission:${submissionId}`])) as Record<string, unknown> | null;
          if (!verdict?.ready) continue;

          if (chainJob.mode !== 2) {
            await relayVerdict({
              jobId,
              freelancer: submission.freelancer,
              rewardWei: chainJob.rewardAmount.toString(),
              passed: Boolean(verdict.meets_criteria),
              qualityScore: Number(verdict.quality_score ?? 0),
              issues: String(verdict.issues ?? ""),
              summary: String(verdict.summary ?? ""),
              retryCount: Number(chainJob.retryCount)
            });
            relayed++;
          }

          const result = Boolean(verdict.meets_criteria) ? "passed" : "did not pass";
          notified += await upsertEvents(serviceSupabase(), "notifications", [
            {
              event_key: resultEventKey,
              recipient_wallet: submission.freelancer.toLowerCase(),
              kind: Boolean(verdict.meets_criteria) ? "verdict_pass" : "verdict_fail",
              job_id: jobId,
              payload: { message: `Your submission for "${chainJob.title}" ${result} AI review.` }
            },
            {
              event_key: eventKey("submission-verdict", submissionId, chainJob.client),
              recipient_wallet: chainJob.client.toLowerCase(),
              kind: "review_result",
              job_id: jobId,
              payload: { message: `A submission for "${chainJob.title}" ${result} AI review.` }
            }
          ]);
          logJson("cron/poll-genlayer", "info", "verdict processed", { jobId, submissionId, passed: Boolean(verdict.meets_criteria) });
        } catch (e) {
          failed++;
          logJson("cron/poll-genlayer", "error", "submission failed", { jobId, submissionId, error: (e as Error).message });
        }
      }
    }
    return NextResponse.json({ ok: failed === 0, processed, relayed, notified, failed }, { status: failed === 0 ? 200 : 500 });
  } catch (e) {
    logJson("cron/poll-genlayer", "error", "cycle failed", { error: (e as Error).message });
    return NextResponse.json({ ok: false, error: (e as Error).message, processed, relayed, notified, failed }, { status: 500 });
  }
}
