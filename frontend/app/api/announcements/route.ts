import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { verifyAdminAction } from "@/lib/auth";
import { ipFromRequest, rateLimit } from "@/lib/rate-limit";

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
  const limit = rateLimit(`announce:${ipFromRequest(request.headers)}`, 30);
  if (!limit.ok) return NextResponse.json({ error: "rate limit" }, { status: 429 });

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const verdict = await verifyAdminAction(request.headers.get("authorization"), "announcement_create");
  if ("error" in verdict) return NextResponse.json({ error: verdict.error }, { status: 403 });

  const body = await request.json();
  const { data, error } = await supabase.from("announcements").insert({
    message: body.message,
    kind: body.kind ?? "info",
    active: body.active ?? true,
    created_by: verdict.wallet
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ announcement: data });
}

export async function PATCH(request: NextRequest) {
  const limit = rateLimit(`announce:${ipFromRequest(request.headers)}`, 30);
  if (!limit.ok) return NextResponse.json({ error: "rate limit" }, { status: 429 });

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const body = await request.json();
  const verdict = await verifyAdminAction(request.headers.get("authorization"), "announcement_update");
  if ("error" in verdict) return NextResponse.json({ error: verdict.error }, { status: 403 });

  const { id, active } = body;
  const { error } = await supabase.from("announcements").update({ active }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
