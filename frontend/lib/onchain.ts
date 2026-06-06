import {
  createPublicClient,
  formatEther,
  getAddress,
  http,
  parseEventLogs,
  type Hex
} from "viem";
import { arbitrumSepolia } from "viem/chains";
import { workProofAbi, workProofAddress } from "./contracts";
import type { Activity, Job, JobStatus, UserProfile } from "./types";

const zeroAddress = "0x0000000000000000000000000000000000000000";
const statusLabels: JobStatus[] = ["Open", "Active", "UnderReview", "Failed", "AwaitingApproval", "Passed", "Complete", "Refunded", "Deleted"];
const modeLabels = ["Application", "Direct", "Competitive"] as const;

function client() {
  const rpc = process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC ?? process.env.ARBITRUM_SEPOLIA_RPC ?? "https://sepolia-rollup.arbitrum.io/rpc";
  if (!workProofAddress) return null;
  return createPublicClient({ chain: arbitrumSepolia, transport: http(rpc) });
}

function safeDate(seconds: bigint | number | string) {
  return new Date(Number(seconds) * 1000).toISOString();
}

function descriptionFromCriteria(criteria: string, title: string, rewardAmount: bigint, domain: string) {
  const brief = criteria.match(/PROJECT BRIEF:\s*([\s\S]*?)(?:\n\s*ACCEPTANCE CRITERIA:|\n\s*DELIVERABLES:|$)/i)?.[1]?.trim();
  if (brief) return brief.replace(/\s+/g, " ");
  // Fallback: if criteria is quite long it's probably the raw text, use the first 300 chars
  if (criteria.length > 60) return criteria.slice(0, 300).replace(/\s+/g, " ") + (criteria.length > 300 ? "…" : "");
  return title;
}

function normalizeJob(raw: Awaited<ReturnType<NonNullable<ReturnType<typeof client>>["readContract"]>>): Job {
  const job = raw as {
    jobId: Hex;
    client: Hex;
    assignedFreelancer: Hex;
    escrowAmount: bigint;
    rewardAmount: bigint;
    title: string;
    specIpfsHash: string;
    acceptanceCriteria: string;
    domain: string;
    deliverableUrl: string;
    status: number;
    createdAt: bigint;
    deadline: bigint;
    retryCount: bigint;
    mode: number;
    approvedSubmissionId: Hex;
  };
  const freelancer = job.assignedFreelancer === zeroAddress ? null : getAddress(job.assignedFreelancer);
  return {
    id: job.jobId,
    job_id_onchain: job.jobId,
    client_wallet: getAddress(job.client),
    freelancer_wallet: freelancer,
    assigned_to_wallet: freelancer,
    title: job.title,
    description: descriptionFromCriteria(job.acceptanceCriteria, job.title, job.rewardAmount, job.domain),
    spec_ipfs_hash: job.specIpfsHash || null,
    acceptance_criteria: job.acceptanceCriteria,
    domain: job.domain,
    escrow_amount_wei: job.escrowAmount.toString(),
    reward_amount_wei: job.rewardAmount.toString(),
    status: statusLabels[job.status] ?? "Open",
    retry_count: Number(job.retryCount),
    deliverable_url: job.deliverableUrl || null,
    ai_verdict: job.status >= 3 ? { source: "onchain", status: statusLabels[job.status] } : null,
    deadline: safeDate(job.deadline),
    created_at: safeDate(job.createdAt),
    completed_at: job.status === 6 ? new Date().toISOString() : null,
    mode: modeLabels[job.mode] ?? "Application",
    approved_submission_id: job.approvedSubmissionId && job.approvedSubmissionId !== `0x${"0".repeat(64)}` ? job.approvedSubmissionId : null
  };
}

export async function getOnchainJobs(limit = 100): Promise<Job[]> {
  const publicClient = client();
  if (!publicClient || !workProofAddress) return [];
  const address = workProofAddress;
  try {
    const ids = await publicClient.readContract({ address, abi: workProofAbi, functionName: "getJobIds" });
    const selected = [...ids].reverse().slice(0, limit);
    const results = await publicClient.multicall({
      allowFailure: true,
      contracts: selected.map((jobId) => ({ address, abi: workProofAbi, functionName: "getJob", args: [jobId] }))
    });
    return results.flatMap((result) => result.status === "success" ? [normalizeJob(result.result)] : []);
  } catch (error) {
    console.warn("onchain jobs fallback failed", error instanceof Error ? error.message : error);
    return [];
  }
}

export async function getOnchainJob(jobId: string): Promise<Job | null> {
  const publicClient = client();
  if (!publicClient || !workProofAddress || !jobId.startsWith("0x")) return null;
  const address = workProofAddress;
  try {
    const raw = await publicClient.readContract({ address, abi: workProofAbi, functionName: "getJob", args: [jobId as Hex] });
    return normalizeJob(raw);
  } catch (error) {
    console.warn("onchain job fallback failed", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function getOnchainUsers(limit = 100): Promise<UserProfile[]> {
  const publicClient = client();
  if (!publicClient || !workProofAddress) return [];
  const address = workProofAddress;
  try {
    const profiles = await publicClient.readContract({ address, abi: workProofAbi, functionName: "getTopFreelancers", args: [BigInt(limit)] });
    return profiles
      .filter((profile) => profile.wallet !== zeroAddress)
      .map((profile) => ({
        wallet_address: getAddress(profile.wallet),
        display_name: null,
        bio: null,
        avatar_url: null,
        domains: profile.domain ? [profile.domain] : null,
        role: "freelancer",
        reputation_pts: Number(profile.reputationPoints),
        jobs_posted: 0,
        jobs_completed: Number(profile.jobsCompleted),
        jobs_failed: Number(profile.jobsFailed),
        total_earned_wei: profile.totalEarned.toString()
      }));
  } catch (error) {
    console.warn("onchain users fallback failed", error instanceof Error ? error.message : error);
    return [];
  }
}

export async function getOnchainActivities(limit = 20, jobId?: string): Promise<Activity[]> {
  const publicClient = client();
  if (!publicClient || !workProofAddress) return [];
  const address = workProofAddress;
  try {
    const latest = await publicClient.getBlockNumber();
    const configured = process.env.NEXT_PUBLIC_WORKPROOF_FROM_BLOCK ? BigInt(process.env.NEXT_PUBLIC_WORKPROOF_FROM_BLOCK) : undefined;
    const fromBlock = configured ?? (latest > 250000n ? latest - 250000n : 0n);
    const logs = await publicClient.getLogs({ address, fromBlock, toBlock: "latest" });
    const parsed = parseEventLogs({
      abi: workProofAbi,
      logs,
      eventName: [
        "JobPosted",
        "ApplicationSubmitted",
        "JobAccepted",
        "WorkSubmitted",
        "SubmissionRecorded",
        "SubmissionRejected",
        "ClientApproved",
        "VerdictReceived",
        "VerdictOverridden",
        "RewardClaimed",
        "JobRefunded",
        "JobDeleted",
        "EscrowToppedUp",
        "WalletBanned",
        "WalletUnbanned"
      ]
    });

    const filtered = parsed.filter((event) => {
      if (!jobId) return true;
      const args = event.args as Record<string, unknown>;
      const eventJobId = typeof args.jobId === "string" ? args.jobId : null;
      return eventJobId ? eventJobId.toLowerCase() === jobId.toLowerCase() : false;
    });

    const recent = filtered.reverse().slice(0, limit);

    // Batch-fetch unique blocks for timestamps
    const uniqBlocks = Array.from(new Set(recent.map((e) => e.blockNumber!).filter(Boolean)));
    const blockResults = await Promise.all(
      uniqBlocks.map((bn) => publicClient.getBlock({ blockNumber: bn }).catch(() => null))
    );
    const blockTimestampByNumber = new Map<bigint, bigint>();
    uniqBlocks.forEach((bn, i) => {
      const b = blockResults[i];
      if (b) blockTimestampByNumber.set(bn, b.timestamp);
    });

    return recent.map((event, index) => {
      const args = event.args as Record<string, unknown>;
      const typeMap: Record<string, string> = {
        JobPosted: "job_posted",
        ApplicationSubmitted: "application_submitted",
        JobAccepted: "job_accepted",
        WorkSubmitted: "work_submitted",
        SubmissionRecorded: "submission_recorded",
        SubmissionRejected: "submission_rejected",
        ClientApproved: "client_approved",
        VerdictReceived: args.passed ? "verdict_pass" : "verdict_fail",
        VerdictOverridden: args.passed ? "verdict_override_pass" : "verdict_override_fail",
        RewardClaimed: "reward_claimed",
        JobRefunded: "refund_issued",
        JobDeleted: "job_deleted",
        EscrowToppedUp: "escrow_topped_up",
        WalletBanned: "wallet_banned",
        WalletUnbanned: "wallet_unbanned"
      };
      const ts = event.blockNumber ? blockTimestampByNumber.get(event.blockNumber) : undefined;
      const created = ts !== undefined ? new Date(Number(ts) * 1000).toISOString() : new Date().toISOString();
      const rawJobId = typeof args.jobId === "string" ? args.jobId : "";
      const validJobId = rawJobId.startsWith("0x") && rawJobId.length === 66 ? rawJobId : "";
      const actor = String(args.client ?? args.freelancer ?? args.wallet ?? args.by ?? "");
      return {
        id: `${event.transactionHash}-${index}`,
        event_type: typeMap[event.eventName] ?? event.eventName,
        job_id: validJobId,
        actor_wallet: actor,
        target_wallet: null,
        metadata: Object.fromEntries(Object.entries(args).map(([key, value]) => [key, typeof value === "bigint" ? value.toString() : value])),
        tx_hash: event.transactionHash,
        created_at: created
      };
    });
  } catch (error) {
    console.warn("onchain activity fallback failed", error instanceof Error ? error.message : error);
    return [];
  }
}
