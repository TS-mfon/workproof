export type JobStatus = "Open" | "Active" | "UnderReview" | "Failed" | "AwaitingApproval" | "Passed" | "Complete" | "Refunded" | "Deleted";
export type JobMode = "Application" | "Direct" | "Competitive";

export type Notification = {
  id: string;
  recipient_wallet: string;
  kind: string;
  job_id: string | null;
  payload: Record<string, unknown> | null;
  seen_at: string | null;
  created_at: string;
};

export type Announcement = {
  id: string;
  message: string;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

export type Dispute = {
  id: string;
  job_id_onchain: string;
  opener_wallet: string;
  reason: string;
  status: "open" | "resolved";
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

export type Badge = {
  slug: string;
  name: string;
  description: string;
  icon: string;
};

export type EarnedBadge = {
  wallet_address: string;
  badge_slug: string;
  earned_at: string;
};

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
  mode?: JobMode;
  approved_submission_id?: string | null;
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
