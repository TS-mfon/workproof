import { env } from "../config.js";
import { getJobRow, supabase } from "../db/supabase.js";
import { relayVerdict } from "../actions/relayVerdict.js";

async function callGenLayer(method: string, args: unknown[]) {
  const response = await fetch(env.GENLAYER_STUDIO_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "gen_callContractMethod",
      params: { contract: env.GENLAYER_CONTRACT, method, args }
    })
  });
  if (!response.ok) throw new Error(`GenLayer ${method} failed: ${response.status}`);
  const body = await response.json();
  return body.result ?? body;
}

export async function pollGenLayerOnce() {
  const { data, error } = await supabase
    .from("jobs")
    .select("job_id_onchain, freelancer_wallet, reward_amount_wei")
    .eq("status", "UnderReview");
  if (error) throw error;

  for (const row of data ?? []) {
    const verdict = await callGenLayer("get_verdict", [row.job_id_onchain]);
    if (!verdict?.ready || verdict.verdict_emitted) continue;

    const job = await getJobRow(row.job_id_onchain);
    await relayVerdict({
      jobId: row.job_id_onchain,
      freelancer: row.freelancer_wallet,
      rewardWei: row.reward_amount_wei,
      passed: Boolean(verdict.meets_criteria),
      qualityScore: Number(verdict.quality_score ?? 0),
      issues: String(verdict.issues ?? ""),
      summary: String(verdict.summary ?? ""),
      retryCount: Number(job.retry_count ?? verdict.retry_count ?? 0)
    });
    await callGenLayer("mark_verdict_emitted", [row.job_id_onchain]);
  }
}

export function startGenLayerPoller() {
  const timer = setInterval(() => {
    pollGenLayerOnce().catch((error) => console.error("GenLayer poll failed", error));
  }, env.POLL_INTERVAL_MS);
  return () => clearInterval(timer);
}
