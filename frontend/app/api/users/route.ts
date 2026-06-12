import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { requireWalletSession } from "@/lib/wallet-session";

export async function GET(request: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ users: [] });
  const wallet = request.nextUrl.searchParams.get("wallet");
  const query = supabase.from("users").select("*");
  const { data, error } = wallet ? await query.eq("wallet_address", wallet).maybeSingle() : await query.order("reputation_pts", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(wallet ? { user: data } : { users: data ?? [] });
}

export async function POST(request: NextRequest) {
  const session = await requireWalletSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  const body = await request.json();
  if (String(body.wallet_address ?? "").toLowerCase() !== session.wallet) {
    return NextResponse.json({ error: "wallet mismatch" }, { status: 403 });
  }
  const allowed = {
    wallet_address: session.wallet,
    display_name: body.display_name,
    bio: body.bio,
    avatar_url: body.avatar_url,
    domains: body.domains,
    role: body.role
  };
  const { data, error } = await supabase.from("users").upsert(allowed, { onConflict: "wallet_address" }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}
