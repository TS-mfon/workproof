import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { verifyAdminAction } from "@/lib/auth";
import { ipFromRequest, rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const limit = rateLimit(`admin:${ipFromRequest(request.headers)}`, 30);
  if (!limit.ok) return NextResponse.json({ error: "rate limit" }, { status: 429 });

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, note: "Supabase not configured" });

  const body = await request.json();
  const verdict = await verifyAdminAction(request.headers.get("authorization"), body.action_type || "admin_action");
  if ("error" in verdict) return NextResponse.json({ error: verdict.error }, { status: 403 });

  const { data, error } = await supabase.from("admin_actions").insert({
    admin_wallet: verdict.wallet,
    action_type: body.action_type,
    target_id: body.target_id,
    reason: body.reason,
    tx_hash: body.tx_hash
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ action: data });
}
