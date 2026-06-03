import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ notifications: [] });
  const wallet = request.nextUrl.searchParams.get("wallet")?.toLowerCase();
  if (!wallet) return NextResponse.json({ notifications: [] });
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_wallet", wallet)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ notifications: [], note: error.message });
  return NextResponse.json({ notifications: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, note: "Supabase not configured" });
  const body = await request.json();
  if (Array.isArray(body)) {
    const { error } = await supabase.from("notifications").insert(body);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "mark-seen" && body.wallet) {
    const { error } = await supabase
      .from("notifications")
      .update({ seen_at: new Date().toISOString() })
      .eq("recipient_wallet", body.wallet.toLowerCase())
      .is("seen_at", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  const { data, error } = await supabase.from("notifications").insert(body).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notification: data });
}
