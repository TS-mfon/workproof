import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function serviceSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_KEY missing");
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

export async function logActivity(input: {
  event_key: string;
  event_type: string;
  job_id?: string;
  actor_wallet?: string;
  target_wallet?: string;
  metadata?: Record<string, unknown>;
  tx_hash?: string;
}) {
  const { error } = await serviceSupabase().from("activity_log").upsert(input, {
    onConflict: "event_key",
    ignoreDuplicates: true
  });
  if (error) throw error;
}

export async function updateJob(jobId: string, updates: Record<string, unknown>) {
  const { error } = await serviceSupabase().from("jobs").update(updates).eq("job_id_onchain", jobId);
  if (error) throw error;
}

export async function getJobRow(jobId: string) {
  const { data, error } = await serviceSupabase()
    .from("jobs")
    .select("*")
    .eq("job_id_onchain", jobId)
    .single();
  if (error) throw error;
  return data;
}
