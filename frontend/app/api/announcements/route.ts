import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ announcements: [] });
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) return NextResponse.json({ announcements: [], note: error.message });
  return NextResponse.json({ announcements: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const adminWallet = request.headers.get("x-admin-wallet")?.toLowerCase();
  const allowedAdmins = (process.env.ADMIN_WALLETS || process.env.NEXT_PUBLIC_ADMIN_WALLETS || "").split(",").map((w) => w.trim().toLowerCase()).filter(Boolean);
  if (!adminWallet || !allowedAdmins.includes(adminWallet)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  const body = await request.json();
  const { data, error } = await supabase.from("announcements").insert({
    message: body.message,
    kind: body.kind ?? "info",
    active: body.active ?? true,
    created_by: adminWallet
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ announcement: data });
}

export async function PATCH(request: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const adminWallet = request.headers.get("x-admin-wallet")?.toLowerCase();
  const allowedAdmins = (process.env.ADMIN_WALLETS || process.env.NEXT_PUBLIC_ADMIN_WALLETS || "").split(",").map((w) => w.trim().toLowerCase()).filter(Boolean);
  if (!adminWallet || !allowedAdmins.includes(adminWallet)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  const { id, active } = await request.json();
  const { error } = await supabase.from("announcements").update({ active }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
