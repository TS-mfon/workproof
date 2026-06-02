import { getSupabaseServer } from "./supabase";
import { getOnchainActivities, getOnchainJob, getOnchainJobs, getOnchainUsers } from "./onchain";
import type { Activity, Claim, Job, UserProfile } from "./types";

export async function getJobs(limit = 100) {
  const supabase = getSupabaseServer();
  if (!supabase) return getOnchainJobs(limit);
  const { data, error } = await supabase.from("jobs").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error || !data?.length) return getOnchainJobs(limit);
  return data as Job[];
}

export async function getJob(id: string) {
  const supabase = getSupabaseServer();
  if (!supabase) return getOnchainJob(id);
  const { data, error } = await supabase.from("jobs").select("*").eq("job_id_onchain", id).maybeSingle();
  if (error || !data) return getOnchainJob(id);
  return data as Job;
}

export async function getActivities(limit = 20, jobId?: string) {
  const supabase = getSupabaseServer();
  if (!supabase) return getOnchainActivities(limit, jobId);
  let query = supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(limit);
  if (jobId) query = query.eq("job_id", jobId);
  const { data, error } = await query;
  if (error || !data?.length) return getOnchainActivities(limit, jobId);
  return data as Activity[];
}

export async function getUsers(limit = 100) {
  const supabase = getSupabaseServer();
  if (!supabase) return getOnchainUsers(limit);
  const { data, error } = await supabase.from("users").select("*").order("reputation_pts", { ascending: false }).limit(limit);
  if (error || !data?.length) return getOnchainUsers(limit);
  return data as UserProfile[];
}

export async function getClaims(wallet?: string) {
  const supabase = getSupabaseServer();
  if (!supabase || !wallet) return [] as Claim[];
  const { data } = await supabase
    .from("claim_queue")
    .select("*, jobs(title, domain)")
    .eq("freelancer_wallet", wallet)
    .order("passed_at", { ascending: false });
  return (data ?? []) as Claim[];
}

export async function getStats() {
  const jobs = await getJobs(1000);
  const users = await getUsers(1000);
  return {
    totalJobs: jobs.length,
    totalEscrowed: jobs.reduce((sum, job) => sum + BigInt(job.escrow_amount_wei || "0"), 0n).toString(),
    completed: jobs.filter((job) => job.status === "Complete").length,
    activeFreelancers: users.filter((user) => user.jobs_completed > 0 || user.role !== "client").length
  };
}
