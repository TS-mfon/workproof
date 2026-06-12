// Chain-authoritative reads over the WorkProof view getters. Pure functions
// that take any viem PublicClient, so they work in client components
// (usePublicClient) and in server/cron routes (createPublicClient) alike.
import type { PublicClient } from "viem";
import { workProofAbi, workProofAddress } from "./contracts";

// JobStatus enum (matches contracts/arbitrum/WorkProof.sol)
export const JOB_STATUS = [
  "Open", "Active", "UnderReview", "Failed", "AwaitingApproval", "Passed", "Complete", "Refunded", "Deleted"
] as const;
export type JobStatusName = (typeof JOB_STATUS)[number];
export const JOB_MODE = ["Application", "Direct", "Competitive"] as const;
export type JobModeName = (typeof JOB_MODE)[number];

export const TERMINAL_STATUSES = new Set<JobStatusName>(["Complete", "Refunded", "Deleted"]);

export type ChainJob = {
  jobId: `0x${string}`;
  client: `0x${string}`;
  assignedFreelancer: `0x${string}`;
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
  genLayerJobId: `0x${string}`;
  verdictAt: bigint;
  mode: number;
  approvedSubmissionId: `0x${string}`;
};

export type ChainSubmission = {
  submissionId: `0x${string}`;
  jobId: `0x${string}`;
  freelancer: `0x${string}`;
  deliverableUrl: string;
  attempt: bigint;
  status: number;
  submittedAt: bigint;
  qualityScore: bigint;
  reasoning: string;
};

export type ChainProfile = {
  wallet: `0x${string}`;
  reputationPoints: bigint;
  jobsCompleted: bigint;
  jobsFailed: bigint;
  totalEarned: bigint;
  domain: string;
};

const ZERO = "0x0000000000000000000000000000000000000000";

function addr(override?: `0x${string}`): `0x${string}` {
  const a = override ?? workProofAddress;
  if (!a) throw new Error("WorkProof contract address is not configured");
  return a;
}

export function statusName(status: number): JobStatusName {
  return JOB_STATUS[status] ?? "Open";
}
export function modeName(mode: number): JobModeName {
  return JOB_MODE[mode] ?? "Application";
}
export function isAssigned(job: ChainJob): boolean {
  return job.assignedFreelancer.toLowerCase() !== ZERO;
}

export async function readJobIds(client: PublicClient, contract?: `0x${string}`): Promise<`0x${string}`[]> {
  return (await client.readContract({ address: addr(contract), abi: workProofAbi, functionName: "getJobIds" })) as `0x${string}`[];
}

export async function readJob(client: PublicClient, jobId: `0x${string}`, contract?: `0x${string}`): Promise<ChainJob> {
  return (await client.readContract({ address: addr(contract), abi: workProofAbi, functionName: "getJob", args: [jobId] })) as ChainJob;
}

export async function readAllJobs(client: PublicClient, contract?: `0x${string}`): Promise<ChainJob[]> {
  const ids = await readJobIds(client, contract);
  if (ids.length === 0) return [];
  const results = await client.multicall({
    allowFailure: true,
    contracts: ids.map((id) => ({ address: addr(contract), abi: workProofAbi, functionName: "getJob", args: [id] } as const))
  });
  const failures = results.flatMap((result, index) =>
    result.status === "failure" ? [`${ids[index]}: ${result.error.message}`] : []
  );
  if (failures.length > 0) {
    throw new Error(`Failed to read ${failures.length} on-chain job(s): ${failures.join("; ")}`);
  }
  return results.map((result) => (result as { status: "success"; result: unknown }).result as ChainJob);
}

export async function readApplicants(client: PublicClient, jobId: `0x${string}`, contract?: `0x${string}`): Promise<`0x${string}`[]> {
  return (await client.readContract({ address: addr(contract), abi: workProofAbi, functionName: "getApplicants", args: [jobId] })) as `0x${string}`[];
}

export async function readHasApplied(client: PublicClient, jobId: `0x${string}`, wallet: `0x${string}`, contract?: `0x${string}`): Promise<boolean> {
  return (await client.readContract({ address: addr(contract), abi: workProofAbi, functionName: "hasApplied", args: [jobId, wallet] })) as boolean;
}

export async function readJobSubmissions(client: PublicClient, jobId: `0x${string}`, contract?: `0x${string}`): Promise<`0x${string}`[]> {
  return (await client.readContract({ address: addr(contract), abi: workProofAbi, functionName: "getJobSubmissions", args: [jobId] })) as `0x${string}`[];
}

export async function readSubmission(client: PublicClient, submissionId: `0x${string}`, contract?: `0x${string}`): Promise<ChainSubmission> {
  return (await client.readContract({ address: addr(contract), abi: workProofAbi, functionName: "getSubmission", args: [submissionId] })) as ChainSubmission;
}

export async function readProfile(client: PublicClient, wallet: `0x${string}`, contract?: `0x${string}`): Promise<ChainProfile> {
  return (await client.readContract({ address: addr(contract), abi: workProofAbi, functionName: "getProfile", args: [wallet] })) as ChainProfile;
}

export async function readDisputeWindow(client: PublicClient, contract?: `0x${string}`): Promise<bigint> {
  return (await client.readContract({ address: addr(contract), abi: workProofAbi, functionName: "disputeWindow" })) as bigint;
}

export async function readRewardClaimed(client: PublicClient, jobId: `0x${string}`, contract?: `0x${string}`): Promise<boolean> {
  return (await client.readContract({ address: addr(contract), abi: workProofAbi, functionName: "rewardClaimed", args: [jobId] })) as boolean;
}

// Map a chain job into the DB-shaped `Job` object the UI components render.
// Optionally merge a DB row for richer description text.
export function chainJobToJob(j: ChainJob, dbRow?: Record<string, unknown>): import("./types").Job {
  const assigned = isAssigned(j) ? j.assignedFreelancer : null;
  return {
    id: (dbRow?.id as string) ?? j.jobId,
    job_id_onchain: j.jobId,
    client_wallet: j.client,
    freelancer_wallet: assigned,
    assigned_to_wallet: assigned,
    title: j.title || (dbRow?.title as string) || "Untitled job",
    description: (dbRow?.description as string) ?? "",
    spec_ipfs_hash: j.specIpfsHash || null,
    acceptance_criteria: j.acceptanceCriteria || (dbRow?.acceptance_criteria as string) || "",
    domain: j.domain || (dbRow?.domain as string) || "",
    escrow_amount_wei: j.escrowAmount.toString(),
    reward_amount_wei: j.rewardAmount.toString(),
    status: statusName(j.status),
    retry_count: Number(j.retryCount),
    deliverable_url: j.deliverableUrl || null,
    ai_verdict: (dbRow?.ai_verdict as Record<string, unknown>) ?? null,
    deadline: new Date(Number(j.deadline) * 1000).toISOString(),
    created_at: new Date(Number(j.createdAt) * 1000).toISOString(),
    completed_at: (dbRow?.completed_at as string) ?? null,
    mode: modeName(j.mode),
    approved_submission_id: j.approvedSubmissionId
  };
}
