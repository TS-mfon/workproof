import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

function isAdminRequest(request: NextRequest) {
  const adminWallet = request.headers.get("x-admin-wallet")?.toLowerCase();
  const allowed = (process.env.ADMIN_WALLETS || process.env.NEXT_PUBLIC_ADMIN_WALLETS || "")
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  return !!adminWallet && allowed.includes(adminWallet);
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, note: "Supabase not configured" });
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  const body = await request.json();
  const { data, error } = await supabase.from("admin_actions").insert(body).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ action: data });
}
