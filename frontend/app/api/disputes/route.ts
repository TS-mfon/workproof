import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

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
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, note: "Supabase not configured" }, { status: 200 });
  const body = await request.json();
  if (!body.job_id_onchain || !body.opener_wallet || !body.reason) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
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
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const adminWallet = request.headers.get("x-admin-wallet")?.toLowerCase();
  const allowedAdmins = (process.env.ADMIN_WALLETS || process.env.NEXT_PUBLIC_ADMIN_WALLETS || "").split(",").map((w) => w.trim().toLowerCase()).filter(Boolean);
  if (!adminWallet || !allowedAdmins.includes(adminWallet)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  const body = await request.json();
  const { id, status, resolution } = body;
  if (!id || !status) return NextResponse.json({ error: "missing fields" }, { status: 400 });
  const { error } = await supabase.from("disputes").update({
    status,
    resolution: resolution ?? null,
    resolved_by: adminWallet,
    resolved_at: new Date().toISOString()
  }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
