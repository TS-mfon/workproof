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
const statusLabels: JobStatus[] = ["Open", "Active", "UnderReview", "Failed", "Passed", "Complete", "Refunded"];

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
  return `Onchain WorkProof job for ${title}. Reward ${formatEther(rewardAmount)} ETH, domain ${domain}.`;
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
    completed_at: job.status === 5 ? new Date().toISOString() : null
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
      eventName: ["JobPosted", "WorkSubmitted", "VerdictReceived", "RewardClaimed", "JobRefunded"]
    });
    return parsed
      .filter((event) => !jobId || String(event.args.jobId).toLowerCase() === jobId.toLowerCase())
      .reverse()
      .slice(0, limit)
      .map((event, index) => {
        const args = event.args as Record<string, unknown>;
        const typeMap: Record<string, string> = {
          JobPosted: "job_posted",
          WorkSubmitted: "work_submitted",
          VerdictReceived: args.passed ? "verdict_pass" : "verdict_fail",
          RewardClaimed: "reward_claimed",
          JobRefunded: "refund_issued"
        };
        return {
          id: `${event.transactionHash}-${index}`,
          event_type: typeMap[event.eventName] ?? event.eventName,
          job_id: String(args.jobId ?? ""),
          actor_wallet: String(args.client ?? args.freelancer ?? ""),
          target_wallet: null,
          metadata: Object.fromEntries(Object.entries(args).map(([key, value]) => [key, typeof value === "bigint" ? value.toString() : value])),
          tx_hash: event.transactionHash,
          created_at: new Date().toISOString()
        };
      });
  } catch (error) {
    console.warn("onchain activity fallback failed", error instanceof Error ? error.message : error);
    return [];
  }
}
