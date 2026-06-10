import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/oracle/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? 100)));
  try {
    const { data, error } = await serviceSupabase()
      .from("genlayer_submissions")
      .select("job_id, submission_id, gl_tx_id, oracle_address, attempt, signed_at, jobs(title, status, ai_verdict)")
      .order("signed_at", { ascending: false })
      .limit(limit);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, submissions: data ?? [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
