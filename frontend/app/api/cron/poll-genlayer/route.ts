import { NextRequest, NextResponse } from "next/server";
import { authorizeCron, logJson } from "@/lib/oracle/cronAuth";
import { serviceSupabase, getJobRow } from "@/lib/oracle/supabase";
import { rpcGenLayer } from "@/lib/oracle/genlayer";
import { relayVerdict } from "@/lib/oracle/relayVerdict";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = authorizeCron(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: 401 });

  let processed = 0;
  let relayed = 0;
  let failed = 0;

  try {
    const { data, error } = await serviceSupabase()
      .from("jobs")
      .select("job_id_onchain, freelancer_wallet, reward_amount_wei")
      .eq("status", "UnderReview");
    if (error) throw error;

    for (const row of data ?? []) {
      processed++;
      const jobId = row.job_id_onchain as `0x${string}`;
      try {
        const verdict = (await rpcGenLayer("get_verdict", [jobId])) as Record<string, unknown> | null;
        if (!verdict || !verdict.ready || verdict.verdict_emitted) continue;

        const job = await getJobRow(jobId);
        await relayVerdict({
          jobId,
          freelancer: row.freelancer_wallet,
          rewardWei: row.reward_amount_wei,
          passed: Boolean(verdict.meets_criteria),
          qualityScore: Number(verdict.quality_score ?? 0),
          issues: String(verdict.issues ?? ""),
          summary: String(verdict.summary ?? ""),
          retryCount: Number(job.retry_count ?? verdict.retry_count ?? 0)
        });
        await rpcGenLayer("mark_verdict_emitted", [jobId]);
        relayed++;
        logJson("cron/poll-genlayer", "info", "relayed", { jobId, passed: Boolean(verdict.meets_criteria) });
      } catch (e) {
        failed++;
        logJson("cron/poll-genlayer", "error", "job failed", { jobId, error: (e as Error).message });
      }
    }
    return NextResponse.json({ ok: true, processed, relayed, failed });
  } catch (e) {
    logJson("cron/poll-genlayer", "error", "cycle failed", { error: (e as Error).message });
    return NextResponse.json({ ok: false, error: (e as Error).message, processed, relayed, failed }, { status: 500 });
  }
}
