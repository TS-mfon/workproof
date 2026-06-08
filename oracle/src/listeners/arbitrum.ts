import { env } from "../config.js";
import { publicClient } from "../lib/chain.js";
import { workProofAbi } from "../lib/abi.js";
import { logActivity, updateJob } from "../db/supabase.js";
import { triggerVerify } from "../actions/triggerVerify.js";

export function startArbitrumListener() {
  return publicClient.watchContractEvent({
    address: env.WORKPROOF_CONTRACT as `0x${string}`,
    abi: workProofAbi,
    eventName: "WorkSubmitted",
    onLogs: async (logs) => {
      for (const log of logs) {
        const jobId = log.args.jobId!;
        const freelancer = log.args.freelancer!;
        const deliverableUrl = log.args.deliverableUrl!;
        const job = await publicClient.readContract({
          address: env.WORKPROOF_CONTRACT as `0x${string}`,
          abi: workProofAbi,
          functionName: "getJob",
          args: [jobId]
        });

        await updateJob(jobId, {
          status: "UnderReview",
          freelancer_wallet: freelancer,
          deliverable_url: deliverableUrl
        });
        await logActivity({
          event_type: "work_submitted",
          job_id: jobId,
          actor_wallet: freelancer,
          metadata: { deliverableUrl },
          tx_hash: log.transactionHash
        });
        // Production GenLayer signing is the Vercel cron route, not this listener.
        // We deliberately do NOT call triggerVerify here — it shells out to the
        // local `genlayer` CLI with whatever key is configured locally and is the
        // path the stuck non-oracle txs came from.
        void job;
        console.log(
          JSON.stringify({
            ts: new Date().toISOString(),
            component: "oracle/arbitrum-listener",
            level: "info",
            msg: "skip-trigger-verify",
            jobId,
            note: "Vercel cron /api/cron/ingest-submissions signs via the oracle wallet"
          })
        );
      }
    }
  });
}
