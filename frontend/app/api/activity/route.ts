import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ activity: [] });
  const { data, error } = await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (request.nextUrl.searchParams.get("format") === "csv") {
    const csv = ["event_type,job_id,actor_wallet,target_wallet,tx_hash,created_at", ...(data ?? []).map((row) => [row.event_type, row.job_id, row.actor_wallet, row.target_wallet, row.tx_hash, row.created_at].map((v) => JSON.stringify(v ?? "")).join(","))].join("\n");
    return new NextResponse(csv, { headers: { "content-type": "text/csv" } });
  }
  return NextResponse.json({ activity: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  const body = await request.json();
  const { data, error } = await supabase.from("activity_log").insert(body).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ activity: data });
}
