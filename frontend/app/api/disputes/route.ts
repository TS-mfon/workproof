import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { verifyAdminAction } from "@/lib/auth";
import { ipFromRequest, rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ disputes: [] });
  const status = request.nextUrl.searchParams.get("status");
  let q = supabase.from("disputes").select("*").order("created_at", { ascending: false }).limit(200);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ disputes: [], note: error.message });
  return NextResponse.json({ disputes: data ?? [] });
}

export async function POST(request: NextRequest) {
  const limit = rateLimit(`disputes:${ipFromRequest(request.headers)}`, 10);
  if (!limit.ok) return NextResponse.json({ error: "rate limit" }, { status: 429 });

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, note: "Supabase not configured" }, { status: 200 });

  const body = await request.json();
  if (!body.job_id_onchain || !body.opener_wallet || !body.reason) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  if (typeof body.reason !== "string" || body.reason.length > 2000) {
    return NextResponse.json({ error: "reason too long" }, { status: 400 });
  }

  const { data, error } = await supabase.from("disputes").insert({
    job_id_onchain: body.job_id_onchain,
    opener_wallet: body.opener_wallet,
    reason: body.reason
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ dispute: data });
}

export async function PATCH(request: NextRequest) {
  const limit = rateLimit(`disputes:${ipFromRequest(request.headers)}`, 30);
  if (!limit.ok) return NextResponse.json({ error: "rate limit" }, { status: 429 });

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const verdict = await verifyAdminAction(request.headers.get("authorization"), "dispute_resolve");
  if ("error" in verdict) return NextResponse.json({ error: verdict.error }, { status: 403 });

  const body = await request.json();
  const { id, status, resolution } = body;
  if (!id || !status) return NextResponse.json({ error: "missing fields" }, { status: 400 });
  const { error } = await supabase.from("disputes").update({
    status,
    resolution: resolution ?? null,
    resolved_by: verdict.wallet,
    resolved_at: new Date().toISOString()
  }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
