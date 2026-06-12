import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { verifyOracleSignature } from "@/lib/oracle-hmac";
import { ipFromRequest, rateLimit } from "@/lib/rate-limit";
import { serverPublicClient, serverWorkProofAddress } from "@/lib/server-chain";
import { readJob, statusName, isAssigned } from "@/lib/workproof-reads";
import { eventKey } from "@/lib/oracle/events";

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
  if (typeof body.job_id_onchain !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(body.job_id_onchain)) {
    return NextResponse.json({ error: "invalid job_id_onchain" }, { status: 400 });
  }

  // ANTI-CHEAT: the job must already exist on-chain with locked escrow, and the
  // caller-supplied client_wallet must match the on-chain client. Trusted fields
  // (client, escrow, status, deadline, deliverable) are taken FROM CHAIN, not the
  // request body — so nobody can inject a fake/unfunded job into the cache.
  const contract = serverWorkProofAddress();
  if (!contract) return NextResponse.json({ error: "contract not configured" }, { status: 500 });
  let chainJob;
  try {
    chainJob = await readJob(serverPublicClient(), body.job_id_onchain as `0x${string}`, contract);
  } catch {
    return NextResponse.json({ error: "job not found on-chain" }, { status: 422 });
  }
  if (!chainJob || chainJob.client === "0x0000000000000000000000000000000000000000") {
    return NextResponse.json({ error: "job does not exist on-chain" }, { status: 422 });
  }
  if (chainJob.client.toLowerCase() !== String(body.client_wallet).toLowerCase()) {
    return NextResponse.json({ error: "client_wallet does not match on-chain client" }, { status: 403 });
  }
  if (chainJob.escrowAmount <= 0n) {
    return NextResponse.json({ error: "no escrow locked on-chain" }, { status: 422 });
  }

  const txHash = body.tx_hash;
  // Build the row from CHAIN-TRUSTED values; only descriptive text comes from the body.
  const row = {
    job_id_onchain: body.job_id_onchain,
    client_wallet: chainJob.client,
    assigned_to_wallet: isAssigned(chainJob) ? chainJob.assignedFreelancer : null,
    title: chainJob.title || body.title,
    description: typeof body.description === "string" ? body.description : "",
    spec_ipfs_hash: chainJob.specIpfsHash || null,
    acceptance_criteria: chainJob.acceptanceCriteria || body.acceptance_criteria,
    domain: chainJob.domain || body.domain,
    escrow_amount_wei: chainJob.escrowAmount.toString(),
    reward_amount_wei: chainJob.rewardAmount.toString(),
    status: statusName(chainJob.status),
    deadline: new Date(Number(chainJob.deadline) * 1000).toISOString()
  };

  const { error: userErr } = await supabase.from("users").upsert({ wallet_address: chainJob.client, role: "client" }, { onConflict: "wallet_address" });
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });

  const { data, error: jobError } = await supabase.from("jobs").upsert(row, { onConflict: "job_id_onchain" }).select("*").single();
  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 });

  await supabase.from("activity_log").upsert({
    event_key: eventKey("job-posted", row.job_id_onchain, txHash),
    event_type: "job_posted",
    job_id: row.job_id_onchain,
    actor_wallet: row.client_wallet,
    metadata: { title: row.title, domain: row.domain, amount: row.escrow_amount_wei },
    tx_hash: txHash
  }, { onConflict: "event_key", ignoreDuplicates: true });
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
    await supabase.from("activity_log").upsert({
      event_key: eventKey("reward-claimed", job_id_onchain, tx_hash),
      event_type: "reward_claimed", job_id: job_id_onchain, metadata: updates, tx_hash
    }, { onConflict: "event_key", ignoreDuplicates: true });
  }
  return NextResponse.json({ ok: true });
}
