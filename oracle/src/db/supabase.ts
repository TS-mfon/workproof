import { createClient } from "@supabase/supabase-js";
import { env } from "../config.js";

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

export async function logActivity(input: {
  event_key: string;
  event_type: string;
  job_id?: string;
  actor_wallet?: string;
  target_wallet?: string;
  metadata?: Record<string, unknown>;
  tx_hash?: string;
}) {
  const { error } = await supabase.from("activity_log").upsert(input, {
    onConflict: "event_key",
    ignoreDuplicates: true
  });
  if (error) throw error;
}

export async function updateJob(jobId: string, updates: Record<string, unknown>) {
  const { error } = await supabase.from("jobs").update(updates).eq("job_id_onchain", jobId);
  if (error) throw error;
}

export async function getJobRow(jobId: string) {
  const { data, error } = await supabase.from("jobs").select("*").eq("job_id_onchain", jobId).single();
  if (error) throw error;
  return data;
}
