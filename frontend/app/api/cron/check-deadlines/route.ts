import { NextRequest, NextResponse } from "next/server";
import { authorizeCron, logJson } from "@/lib/oracle/cronAuth";
import { serviceSupabase } from "@/lib/oracle/supabase";
import { autoRefund } from "@/lib/oracle/autoRefund";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = authorizeCron(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: 401 });

  let processed = 0;
  let refunded = 0;
  let failed = 0;

  try {
    const { data, error } = await serviceSupabase()
      .from("jobs")
      .select("job_id_onchain, deadline, status")
      .lt("deadline", new Date().toISOString())
      .not("status", "in", "(Passed,Complete,Refunded)");
    if (error) throw error;

    for (const row of data ?? []) {
      processed++;
      try {
        await autoRefund(row.job_id_onchain as `0x${string}`, "Deadline passed");
        refunded++;
        logJson("cron/check-deadlines", "info", "refunded", { jobId: row.job_id_onchain });
      } catch (e) {
        failed++;
        logJson("cron/check-deadlines", "error", "refund failed", {
          jobId: row.job_id_onchain,
          error: (e as Error).message
        });
      }
    }
    return NextResponse.json({ ok: true, processed, refunded, failed });
  } catch (e) {
    logJson("cron/check-deadlines", "error", "cycle failed", { error: (e as Error).message });
    return NextResponse.json(
      { ok: false, error: (e as Error).message, processed, refunded, failed },
      { status: 500 }
    );
  }
}
