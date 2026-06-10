import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/oracle/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only feed backing the oracle page's GenLayer verification table.
// We deliberately DON'T use a PostgREST embed (`jobs(...)`) here: there is no
// FK constraint between genlayer_submissions.job_id and jobs.job_id_onchain, so
// the embed errors with "Could not find a relationship ... in the schema cache".
// Instead we fetch the jobs in a second query and stitch them in by job_id.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? 100)));
  try {
    const supabase = serviceSupabase();
    const { data: subs, error } = await supabase
      .from("genlayer_submissions")
      .select("job_id, submission_id, gl_tx_id, oracle_address, attempt, signed_at")
      .order("signed_at", { ascending: false })
      .limit(limit);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const rows = subs ?? [];
    const jobIds = Array.from(new Set(rows.map((r: any) => r.job_id).filter(Boolean)));

    const jobsById = new Map<string, { title?: string; status?: string; ai_verdict?: unknown }>();
    if (jobIds.length > 0) {
      const { data: jobs } = await supabase
        .from("jobs")
        .select("job_id_onchain, title, status, ai_verdict")
        .in("job_id_onchain", jobIds);
      for (const j of jobs ?? []) {
        jobsById.set(String((j as any).job_id_onchain), {
          title: (j as any).title,
          status: (j as any).status,
          ai_verdict: (j as any).ai_verdict
        });
      }
    }

    const submissions = rows.map((r: any) => ({ ...r, jobs: jobsById.get(String(r.job_id)) ?? null }));
    return NextResponse.json({ ok: true, submissions });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
