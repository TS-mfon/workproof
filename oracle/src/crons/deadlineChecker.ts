import { env } from "../config.js";
import { supabase } from "../db/supabase.js";
import { autoRefund } from "../actions/autoRefund.js";

export async function deadlineCheckOnce() {
  const { data, error } = await supabase
    .from("jobs")
    .select("job_id_onchain, deadline, status")
    .lt("deadline", new Date().toISOString())
    .not("status", "in", "(Passed,Complete,Refunded)");
  if (error) throw error;

  for (const row of data ?? []) {
    await autoRefund(row.job_id_onchain, "Deadline passed");
  }
}

export function startDeadlineChecker() {
  const timer = setInterval(() => {
    deadlineCheckOnce().catch((error) => console.error("Deadline check failed", error));
  }, env.DEADLINE_CHECK_INTERVAL_MS);
  return () => clearInterval(timer);
}
