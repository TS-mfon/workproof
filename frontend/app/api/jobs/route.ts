import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ jobs: [], claims: [] });
  const claimsFor = request.nextUrl.searchParams.get("claimsFor");
  if (claimsFor) {
    const { data, error } = await supabase.from("claim_queue").select("*, jobs(title, domain)").eq("freelancer_wallet", claimsFor).order("passed_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ claims: data ?? [] });
  }
  const { data, error } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  const body = await request.json();
  const txHash = body.tx_hash;
  delete body.tx_hash;
  const { error } = await supabase.from("users").upsert({ wallet_address: body.client_wallet, role: "client" }, { onConflict: "wallet_address" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data, error: jobError } = await supabase.from("jobs").insert(body).select("*").single();
  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 });
  await supabase.from("activity_log").insert({
    event_type: "job_posted",
    job_id: body.job_id_onchain,
    actor_wallet: body.client_wallet,
    metadata: { title: body.title, domain: body.domain, amount: body.escrow_amount_wei },
    tx_hash: txHash
  });
  return NextResponse.json({ job: data });
}

export async function PATCH(request: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  const body = await request.json();
  const { job_id_onchain, claim_id, tx_hash, ...updates } = body;
  const { error } = await supabase.from("jobs").update(updates).eq("job_id_onchain", job_id_onchain);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (claim_id) {
    await supabase.from("claim_queue").update({ status: "claimed", claimed_at: new Date().toISOString() }).eq("id", claim_id);
    await supabase.from("activity_log").insert({ event_type: "reward_claimed", job_id: job_id_onchain, metadata: updates, tx_hash });
  }
  return NextResponse.json({ ok: true });
}
