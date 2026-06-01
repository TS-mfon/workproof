import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  const body = await request.json();
  if (body.job_id_onchain && body.status) {
    await supabase.from("jobs").update({ status: body.status, ai_verdict: body.ai_verdict ?? null }).eq("job_id_onchain", body.job_id_onchain);
  }
  if (body.activity) {
    await supabase.from("activity_log").insert(body.activity);
  }
  return NextResponse.json({ ok: true });
}
