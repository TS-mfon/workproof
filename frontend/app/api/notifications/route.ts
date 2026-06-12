import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/oracle/supabase";
import { requireWalletSession } from "@/lib/wallet-session";

export async function GET() {
  const session = await requireWalletSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = serviceSupabase();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_wallet", session.wallet)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ notifications: [], note: error.message });
  return NextResponse.json({ notifications: data ?? [] });
}

export async function POST(request: NextRequest) {
  const session = await requireWalletSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = serviceSupabase();
  const body = await request.json();
  if (body.action === "mark-seen") {
    const { error } = await supabase
      .from("notifications")
      .update({ seen_at: new Date().toISOString() })
      .eq("recipient_wallet", session.wallet)
      .is("seen_at", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "unsupported action" }, { status: 400 });
}
