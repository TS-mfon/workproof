import { NextRequest, NextResponse } from "next/server";
import { parseAbiItem } from "viem";
import { authorizeCron, logJson } from "@/lib/oracle/cronAuth";
import { arbitrumPublicClient, workProofAddress } from "@/lib/oracle/chain";
import { readCursor, writeCursor } from "@/lib/oracle/cursor";
import { logActivity, serviceSupabase, updateJob } from "@/lib/oracle/supabase";
import { signVerifySubmission, writeGenLayerAudit } from "@/lib/oracle/genlayer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CURSOR_NAME = "ingest_submissions:arb-sepolia";
const MAX_BLOCK_RANGE = 9_500n; // Arbitrum free RPCs cap log range
const START_FALLBACK_LOOKBACK = 5_000n; // first run: scan recent history

const submissionRecordedEvent = parseAbiItem(
  "event SubmissionRecorded(bytes32 indexed jobId, bytes32 indexed submissionId, address indexed freelancer, uint256 attempt, string deliverableUrl)"
);

const getJobAbi = [
  {
    type: "function",
    name: "getJob",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "jobId", type: "bytes32" },
          { name: "client", type: "address" },
          { name: "assignedFreelancer", type: "address" },
          { name: "escrowAmount", type: "uint256" },
          { name: "rewardAmount", type: "uint256" },
          { name: "title", type: "string" },
          { name: "specIpfsHash", type: "string" },
          { name: "acceptanceCriteria", type: "string" },
          { name: "domain", type: "string" },
          { name: "deadline", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "retryCount", type: "uint256" }
        ]
      }
    ]
  }
] as const;

export async function GET(request: NextRequest) {
  const auth = authorizeCron(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: 401 });
  if (!workProofAddress) {
    return NextResponse.json({ ok: false, error: "WORKPROOF_CONTRACT missing" }, { status: 503 });
  }

  let ingested = 0;
  let triggered = 0;
  let failed = 0;

  try {
    const client = arbitrumPublicClient();
    const latest = await client.getBlockNumber();
    const cursor = await readCursor(
      CURSOR_NAME,
      latest > START_FALLBACK_LOOKBACK ? latest - START_FALLBACK_LOOKBACK : 0n
    );
    const fromBlock = cursor + 1n;
    if (fromBlock > latest) {
      return NextResponse.json({ ok: true, ingested: 0, triggered: 0, failed: 0, note: "no new blocks" });
    }
    const toBlock = fromBlock + MAX_BLOCK_RANGE - 1n > latest ? latest : fromBlock + MAX_BLOCK_RANGE - 1n;

    const logs = await client.getLogs({
      address: workProofAddress,
      event: submissionRecordedEvent,
      fromBlock,
      toBlock
    });

    for (const log of logs) {
      ingested++;
      const jobId = log.args.jobId as `0x${string}`;
      const submissionId = log.args.submissionId as `0x${string}`;
      const freelancer = log.args.freelancer as `0x${string}`;
      const deliverableUrl = log.args.deliverableUrl as string;
      const attempt = Number(log.args.attempt ?? 0n);

      try {
        // Update Supabase (idempotent — same row, same status)
        await updateJob(jobId, {
          status: "UnderReview",
          freelancer_wallet: freelancer,
          deliverable_url: deliverableUrl
        });
        await logActivity({
          event_type: "work_submitted",
          job_id: jobId,
          actor_wallet: freelancer,
          metadata: { deliverableUrl, attempt },
          tx_hash: log.transactionHash ?? undefined
        });

        // Fetch criteria from on-chain
        const job = await client.readContract({
          address: workProofAddress,
          abi: getJobAbi,
          functionName: "getJob",
          args: [jobId]
        });
        const criteria = (job as { acceptanceCriteria: string }).acceptanceCriteria;

        // Pre-flight idempotency: if a prior request already signed this
        // (submissionId, attempt), don't re-sign — count as already triggered.
        try {
          const { data: existing } = await serviceSupabase()
            .from("genlayer_submissions")
            .select("gl_tx_id")
            .eq("submission_id", submissionId)
            .eq("attempt", attempt)
            .maybeSingle();
          if (existing) {
            triggered++;
            logJson("cron/ingest-submissions", "info", "already-signed", {
              jobId,
              submissionId,
              glTxId: existing.gl_tx_id
            });
            continue;
          }
        } catch (e) {
          logJson("cron/ingest-submissions", "warn", "preflight lookup failed", {
            error: (e as Error).message
          });
        }

        // Sign GenLayer verify_submission with the oracle wallet
        const signed = await signVerifySubmission({
          jobId,
          submissionId,
          freelancer,
          deliverableUrl,
          criteria,
          attempt
        });
        if (!signed.ok) {
          failed++;
          logJson("cron/ingest-submissions", "warn", "sign failed", {
            jobId,
            submissionId,
            code: signed.code,
            error: signed.error
          });
          continue;
        }
        await writeGenLayerAudit({
          jobId,
          submissionId,
          glTxId: signed.glTxId,
          oracleAddress: signed.oracleAddress,
          attempt
        }).catch((e) =>
          logJson("cron/ingest-submissions", "warn", "audit skipped", { error: (e as Error).message })
        );
        triggered++;
        logJson("cron/ingest-submissions", "info", "triggered", { jobId, submissionId, glTxId: signed.glTxId });
      } catch (e) {
        failed++;
        logJson("cron/ingest-submissions", "error", "row failed", {
          jobId,
          submissionId,
          error: (e as Error).message
        });
      }
    }

    await writeCursor(CURSOR_NAME, toBlock);
    return NextResponse.json({
      ok: true,
      fromBlock: fromBlock.toString(),
      toBlock: toBlock.toString(),
      ingested,
      triggered,
      failed
    });
  } catch (e) {
    logJson("cron/ingest-submissions", "error", "cycle failed", { error: (e as Error).message });
    return NextResponse.json(
      { ok: false, error: (e as Error).message, ingested, triggered, failed },
      { status: 500 }
    );
  }
}
