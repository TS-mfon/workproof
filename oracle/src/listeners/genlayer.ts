import { env } from "../config.js";
import { getJobRow, supabase } from "../db/supabase.js";
import { relayVerdict } from "../actions/relayVerdict.js";

const RPC_TIMEOUT_MS = 20_000;
const BACKOFF_MIN_MS = 1_000;
const BACKOFF_MAX_MS = 60_000;

let currentBackoffMs = BACKOFF_MIN_MS;

function log(level: "info" | "warn" | "error", msg: string, extra: Record<string, unknown> = {}) {
  const payload = { ts: new Date().toISOString(), component: "genlayer-poller", level, msg, ...extra };
  console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](JSON.stringify(payload));
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout:${label}`)), ms))
  ]);
}

async function callGenLayer(method: string, args: unknown[]) {
  const response = await withTimeout(
    fetch(env.GENLAYER_STUDIO_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method: "gen_callContractMethod",
        params: { contract: env.GENLAYER_CONTRACT, method, args }
      })
    }),
    RPC_TIMEOUT_MS,
    `rpc:${method}`
  );
  if (!response.ok) throw new Error(`GenLayer ${method} HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`GenLayer ${method} RPC error: ${body.error.message ?? "unknown"}`);
  return body.result ?? body;
}

export async function pollGenLayerOnce() {
  const { data, error } = await supabase
    .from("jobs")
    .select("job_id_onchain, freelancer_wallet, reward_amount_wei")
    .eq("status", "UnderReview");
  if (error) throw error;

  for (const row of data ?? []) {
    const jobId = row.job_id_onchain;
    try {
      const verdict = await callGenLayer("get_verdict", [jobId]);
      if (!verdict?.ready || verdict.verdict_emitted) continue;

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
      await callGenLayer("mark_verdict_emitted", [jobId]);
      log("info", "relayed verdict", { jobId, passed: Boolean(verdict.meets_criteria), score: verdict.quality_score });
    } catch (err) {
      // Skip-and-continue: one bad job must not crash the whole poll cycle.
      log("error", "job processing failed", { jobId, error: (err as Error).message });
    }
  }
}

export function startGenLayerPoller() {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const tick = async () => {
    if (stopped) return;
    try {
      await pollGenLayerOnce();
      currentBackoffMs = BACKOFF_MIN_MS;
      timer = setTimeout(tick, env.POLL_INTERVAL_MS);
    } catch (err) {
      log("error", "poll cycle failed", { error: (err as Error).message, retryInMs: currentBackoffMs });
      const wait = currentBackoffMs;
      currentBackoffMs = Math.min(currentBackoffMs * 2, BACKOFF_MAX_MS);
      timer = setTimeout(tick, wait);
    }
  };

  timer = setTimeout(tick, env.POLL_INTERVAL_MS);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
