import { arbitrumWalletClient, workProofAddress } from "./chain";
import { workProofAbi } from "@/lib/contracts";
import { logActivity, updateJob } from "./supabase";

export async function autoRefund(jobId: `0x${string}`, reason = "Deadline passed") {
  if (!workProofAddress) throw new Error("WORKPROOF_CONTRACT missing");
  const wallet = arbitrumWalletClient();
  const hash = await wallet.writeContract({
    address: workProofAddress,
    abi: workProofAbi,
    functionName: "autoRefund",
    args: [jobId]
  });
  await updateJob(jobId, { status: "Refunded" });
  await logActivity({
    event_type: "refund_issued",
    job_id: jobId,
    metadata: { reason },
    tx_hash: hash
  });
  return hash;
}
