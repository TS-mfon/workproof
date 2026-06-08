import { NextRequest, NextResponse } from "next/server";
import { ipFromRequest, rateLimit } from "@/lib/rate-limit";
import { signVerifySubmission, writeGenLayerAudit } from "@/lib/oracle/genlayer";
import { serviceSupabase } from "@/lib/oracle/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ErrCode =
  | "invalid_input"
  | "rate_limited"
  | "oracle_misconfigured"
  | "rpc_unreachable"
  | "contract_revert"
  | "timeout"
  | "unknown";

function err(code: ErrCode, message: string, status: number) {
  return NextResponse.json({ ok: false, code, error: message }, { status });
}

export async function POST(request: NextRequest) {
  const limit = rateLimit(`gen-trigger:${ipFromRequest(request.headers)}`, 30);
  if (!limit.ok) {
    return new NextResponse(
      JSON.stringify({ ok: false, code: "rate_limited", error: "Too many requests, slow down." }),
      { status: 429, headers: { "content-type": "application/json", "Retry-After": "60" } }
    );
  }

  let body: {
    jobId?: string;
    submissionId?: string;
    freelancer?: string;
    deliverableUrl?: string;
    criteria?: string;
    attempt?: number;
  };
  try {
    body = await request.json();
  } catch {
    return err("invalid_input", "Invalid JSON body", 400);
  }

  const { jobId, submissionId, freelancer, deliverableUrl, criteria, attempt } = body;
  if (!jobId || !submissionId || !freelancer || !deliverableUrl || !criteria) {
    return err("invalid_input", "Missing required fields", 400);
  }
  if (typeof deliverableUrl !== "string" || !/^https?:\/\//i.test(deliverableUrl)) {
    return err("invalid_input", "Deliverable URL must be public http(s)", 400);
  }
  if (deliverableUrl.length > 2000 || criteria.length > 12000) {
    return err("invalid_input", "Payload too large", 413);
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(jobId) || !/^0x[0-9a-fA-F]{64}$/.test(submissionId)) {
    return err("invalid_input", "Invalid jobId or submissionId format", 400);
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(freelancer)) {
    return err("invalid_input", "Invalid freelancer address", 400);
  }
  const attemptNum = Number(attempt ?? 0);
  if (!Number.isInteger(attemptNum) || attemptNum < 0 || attemptNum > 50) {
    return err("invalid_input", "Invalid attempt value", 400);
  }

  // Pre-flight idempotency: if this (submissionId, attempt) was already signed,
  // return the prior glTxId without re-signing. The audit table has
  // `unique (submission_id, attempt)` so even a concurrent race ends up here.
  try {
    const { data: existing } = await serviceSupabase()
      .from("genlayer_submissions")
      .select("gl_tx_id, oracle_address, signed_at")
      .eq("submission_id", submissionId)
      .eq("attempt", attemptNum)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({
        ok: true,
        alreadySigned: true,
        glTxId: existing.gl_tx_id,
        oracleAddress: existing.oracle_address,
        signedAt: existing.signed_at
      });
    }
  } catch (e) {
    // If the audit lookup fails, we proceed but log it — failing closed here
    // would block legitimate first-time signs when Supabase is briefly down.
    console.warn("[genlayer-trigger] preflight lookup failed:", (e as Error).message);
  }

  const result = await signVerifySubmission({
    jobId,
    submissionId,
    freelancer,
    deliverableUrl,
    criteria,
    attempt: attemptNum
  });

  if (!result.ok) {
    const status =
      result.code === "oracle_misconfigured" ? 503 :
      result.code === "timeout" ? 504 :
      502;
    console.error("[genlayer-trigger]", result.code, result.error);
    return err(result.code as ErrCode, result.error.slice(0, 300), status);
  }

  void writeGenLayerAudit({
    jobId,
    submissionId,
    glTxId: result.glTxId,
    oracleAddress: result.oracleAddress,
    attempt: attemptNum
  }).catch((e) => console.warn("[genlayer-trigger] audit skipped:", (e as Error).message));

  return NextResponse.json({ ok: true, glTxId: result.glTxId, oracleAddress: result.oracleAddress });
}
