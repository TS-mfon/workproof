import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { verifyOracleSignature } from "@/lib/oracle-hmac";

export async function POST(request: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });

  const rawBody = await request.text();
  const sig = request.headers.get("x-oracle-signature");
  if (!verifyOracleSignature(rawBody, sig)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: any;
  try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  if (body.job_id_onchain && body.status) {
    await supabase.from("jobs").update({ status: body.status, ai_verdict: body.ai_verdict ?? null }).eq("job_id_onchain", body.job_id_onchain);
  }
  if (body.activity) {
    if (!body.activity.event_key) {
      return NextResponse.json({ error: "activity.event_key required" }, { status: 400 });
    }
    await supabase.from("activity_log").upsert(body.activity, { onConflict: "event_key", ignoreDuplicates: true });
  }
  return NextResponse.json({ ok: true });
}
