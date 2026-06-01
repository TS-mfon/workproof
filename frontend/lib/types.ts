export type JobStatus = "Open" | "Active" | "UnderReview" | "Failed" | "Passed" | "Complete" | "Refunded";

export type Job = {
  id: string;
  job_id_onchain: string;
  client_wallet: string;
  freelancer_wallet: string | null;
  assigned_to_wallet: string | null;
  title: string;
  description: string;
  spec_ipfs_hash: string | null;
  acceptance_criteria: string;
  domain: string;
  escrow_amount_wei: string;
  reward_amount_wei: string;
  status: JobStatus;
  retry_count: number;
  deliverable_url: string | null;
  ai_verdict: Record<string, unknown> | null;
  deadline: string;
  created_at: string;
  completed_at: string | null;
};

export type UserProfile = {
  wallet_address: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  domains: string[] | null;
  role: "client" | "freelancer" | "both";
  reputation_pts: number;
  jobs_posted: number;
  jobs_completed: number;
  jobs_failed: number;
  total_earned_wei: string;
  banned?: boolean;
};

export type Activity = {
  id: string;
  event_type: string;
  job_id: string | null;
  actor_wallet: string | null;
  target_wallet: string | null;
  metadata: Record<string, unknown> | null;
  tx_hash: string | null;
  created_at: string;
};

export type Claim = {
  id: string;
  job_id_onchain: string;
  freelancer_wallet: string;
  reward_wei: string;
  quality_score: number | null;
  ai_summary: string | null;
  reputation_pts: number | null;
  status: "pending" | "claimed";
  passed_at: string;
  claimed_at: string | null;
  jobs?: Pick<Job, "title" | "domain">;
};
