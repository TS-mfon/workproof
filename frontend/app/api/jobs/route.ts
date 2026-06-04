import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { verifyOracleSignature } from "@/lib/oracle-hmac";
import { ipFromRequest, rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ jobs: [], claims: [] });
  const claimsFor = request.nextUrl.searchParams.get("claimsFor");
  if (claimsFor) {
    const { data, error } = await supabase
      .from("claim_queue")
      .select("*, jobs(title, domain)")
      .eq("freelancer_wallet", claimsFor)
      .order("passed_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ claims: data ?? [] });
  }
  const { data, error } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data ?? [] });
}

export async function POST(request: NextRequest) {
  const limit = rateLimit(`jobs:${ipFromRequest(request.headers)}`, 30);
  if (!limit.ok) return NextResponse.json({ error: "rate limit" }, { status: 429 });

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });

  const body = await request.json();

  // Cheap length sanity checks (L-4)
  const maxLen = (v: unknown, n: number) => typeof v === "string" && v.length <= n;
  if (!maxLen(body.title, 200) || !maxLen(body.description, 8000) || !maxLen(body.acceptance_criteria, 8000)) {
    return NextResponse.json({ error: "payload field too long" }, { status: 400 });
  }
  if (typeof body.client_wallet !== "string" || !body.client_wallet.startsWith("0x")) {
    return NextResponse.json({ error: "invalid client_wallet" }, { status: 400 });
  }
  if (typeof body.job_id_onchain !== "string" || !body.job_id_onchain.startsWith("0x")) {
    return NextResponse.json({ error: "invalid job_id_onchain" }, { status: 400 });
  }

  const txHash = body.tx_hash;
  delete body.tx_hash;
  const { error: userErr } = await supabase.from("users").upsert({ wallet_address: body.client_wallet, role: "client" }, { onConflict: "wallet_address" });
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });

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

// PATCH is now oracle-only. Each call must include an HMAC over the raw body in
// the `x-oracle-signature` header, derived from ORACLE_WEBHOOK_SECRET.
export async function PATCH(request: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });

  const rawBody = await request.text();
  const sig = request.headers.get("x-oracle-signature");
  if (!verifyOracleSignature(rawBody, sig)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: any;
  try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  const { job_id_onchain, claim_id, tx_hash, ...updates } = body;
  const { error } = await supabase.from("jobs").update(updates).eq("job_id_onchain", job_id_onchain);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (claim_id) {
    await supabase.from("claim_queue").update({ status: "claimed", claimed_at: new Date().toISOString() }).eq("id", claim_id);
    await supabase.from("activity_log").insert({ event_type: "reward_claimed", job_id: job_id_onchain, metadata: updates, tx_hash });
  }
  return NextResponse.json({ ok: true });
}
