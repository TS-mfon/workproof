import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

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
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  const body = await request.json();
  const { data, error } = await supabase.from("users").upsert(body, { onConflict: "wallet_address" }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}
