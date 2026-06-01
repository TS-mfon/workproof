import { env } from "../config.js";
import { walletClient } from "../lib/chain.js";
import { workProofAbi } from "../lib/abi.js";
import { logActivity, supabase, updateJob } from "../db/supabase.js";

export async function relayVerdict(input: {
  jobId: `0x${string}`;
  freelancer: string;
  rewardWei: string;
  passed: boolean;
  qualityScore: number;
  issues: string;
  summary: string;
  retryCount: number;
}) {
  const paymentPct = Math.max(0, Math.min(100, input.qualityScore));
  const reasoning = input.passed ? input.summary : input.issues || input.summary;
  const hash = await walletClient.writeContract({
    address: env.WORKPROOF_CONTRACT as `0x${string}`,
    abi: workProofAbi,
    functionName: "receiveVerdict",
    args: [input.jobId, input.passed, paymentPct, reasoning]
  });

  if (input.passed) {
    await updateJob(input.jobId, {
      status: "Passed",
      ai_verdict: {
        meets_criteria: true,
        quality_score: input.qualityScore,
        issues: input.issues,
        summary: input.summary,
        retry_count: input.retryCount
      }
    });
    const reputationPts = input.qualityScore >= 90 ? 50 : input.qualityScore >= 75 ? 30 : input.qualityScore >= 60 ? 15 : 0;
    await supabase.from("claim_queue").upsert({
      job_id_onchain: input.jobId,
      freelancer_wallet: input.freelancer,
      reward_wei: input.rewardWei,
      quality_score: input.qualityScore,
      ai_summary: input.summary,
      reputation_pts: input.retryCount === 0 ? reputationPts + 10 : reputationPts,
      status: "pending"
    });
    await logActivity({
      event_type: "verdict_pass",
      job_id: input.jobId,
      actor_wallet: input.freelancer,
      metadata: { score: input.qualityScore, summary: input.summary },
      tx_hash: hash
    });
  } else {
    const nextRetry = input.retryCount + 1;
    await updateJob(input.jobId, {
      status: nextRetry >= 3 ? "Refunded" : "Failed",
      retry_count: nextRetry,
      ai_verdict: {
        meets_criteria: false,
        quality_score: input.qualityScore,
        issues: input.issues,
        summary: input.summary,
        retry_count: input.retryCount
      }
    });
    await logActivity({
      event_type: nextRetry >= 3 ? "refund_issued" : "verdict_fail",
      job_id: input.jobId,
      actor_wallet: input.freelancer,
      metadata: { score: input.qualityScore, issues: input.issues, retry: nextRetry },
      tx_hash: hash
    });
  }

  return hash;
}
