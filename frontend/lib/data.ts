import { getSupabaseServer } from "./supabase";
import { getOnchainActivities, getOnchainJob, getOnchainJobs, getOnchainUsers } from "./onchain";
import type { Activity, Claim, Job, UserProfile } from "./types";

// CHAIN-AUTHORITATIVE. The contract is the single source of truth for which
// jobs exist and their live status — Supabase is only a description cache. This
// guarantees the marketplace and the dashboards never diverge, no duplicates,
// and no ghost rows lingering from a previous contract deployment.
export async function getJobs(limit = 100): Promise<Job[]> {
  const onchainJobs = await getOnchainJobs(limit);
  const supabase = getSupabaseServer();
  if (!supabase || onchainJobs.length === 0) return onchainJobs;
  // Overlay the richer client-authored description (the chain only stores
  // criteria-derived text) keyed by lower-cased job_id_onchain.
  const ids = onchainJobs.map((j) => j.job_id_onchain);
  const { data } = await supabase.from("jobs").select("job_id_onchain, description").in("job_id_onchain", ids);
  const descById = new Map<string, string>();
  for (const r of data ?? []) {
    const d = (r as any).description;
    if (d) descById.set(String((r as any).job_id_onchain).toLowerCase(), d);
  }
  return onchainJobs.map((j) => {
    const d = descById.get(j.job_id_onchain.toLowerCase());
    return d ? { ...j, description: d } : j;
  });
}

export async function getJob(id: string) {
  // Chain first — never serve a stale cached status for the detail page.
  const chainJob = await getOnchainJob(id);
  const supabase = getSupabaseServer();
  if (!supabase) return chainJob;
  if (!chainJob) {
    const { data } = await supabase.from("jobs").select("*").eq("job_id_onchain", id).maybeSingle();
    return (data as Job) ?? null;
  }
  const { data } = await supabase.from("jobs").select("description").eq("job_id_onchain", id).maybeSingle();
  const desc = (data as any)?.description;
  return desc ? { ...chainJob, description: desc } : chainJob;
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
