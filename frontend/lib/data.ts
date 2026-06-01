import { getSupabaseServer } from "./supabase";
import type { Activity, Claim, Job, UserProfile } from "./types";

export async function getJobs(limit = 100) {
  const supabase = getSupabaseServer();
  if (!supabase) return [] as Job[];
  const { data } = await supabase.from("jobs").select("*").order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as Job[];
}

export async function getJob(id: string) {
  const supabase = getSupabaseServer();
  if (!supabase) return null;
  const { data } = await supabase.from("jobs").select("*").eq("job_id_onchain", id).maybeSingle();
  return data as Job | null;
}

export async function getActivities(limit = 20, jobId?: string) {
  const supabase = getSupabaseServer();
  if (!supabase) return [] as Activity[];
  let query = supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(limit);
  if (jobId) query = query.eq("job_id", jobId);
  const { data } = await query;
  return (data ?? []) as Activity[];
}

export async function getUsers(limit = 100) {
  const supabase = getSupabaseServer();
  if (!supabase) return [] as UserProfile[];
  const { data } = await supabase.from("users").select("*").order("reputation_pts", { ascending: false }).limit(limit);
  return (data ?? []) as UserProfile[];
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
