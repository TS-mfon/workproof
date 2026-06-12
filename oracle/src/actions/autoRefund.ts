import { env } from "../config.js";
import { walletClient } from "../lib/chain.js";
import { workProofAbi } from "../lib/abi.js";
import { logActivity, updateJob } from "../db/supabase.js";

export async function autoRefund(jobId: `0x${string}`, reason = "Deadline passed") {
  const hash = await walletClient.writeContract({
    address: env.WORKPROOF_CONTRACT as `0x${string}`,
    abi: workProofAbi,
    functionName: "autoRefund",
    args: [jobId]
  });
  await updateJob(jobId, { status: "Refunded" });
  await logActivity({
    event_key: `refund:${jobId.toLowerCase()}:${hash.toLowerCase()}`,
    event_type: "refund_issued",
    job_id: jobId,
    metadata: { reason },
    tx_hash: hash
  });
  return hash;
}
