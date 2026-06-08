import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/oracle/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const submissionId = searchParams.get("submissionId");
  const attemptRaw = searchParams.get("attempt");

  if (!submissionId || !/^0x[0-9a-fA-F]{64}$/.test(submissionId)) {
    return NextResponse.json({ ok: false, code: "invalid_input", error: "submissionId required" }, { status: 400 });
  }
  const attempt = Number(attemptRaw ?? 0);
  if (!Number.isInteger(attempt) || attempt < 0 || attempt > 50) {
    return NextResponse.json({ ok: false, code: "invalid_input", error: "attempt invalid" }, { status: 400 });
  }

  try {
    const { data } = await serviceSupabase()
      .from("genlayer_submissions")
      .select("gl_tx_id, oracle_address, signed_at, attempt")
      .eq("submission_id", submissionId)
      .eq("attempt", attempt)
      .maybeSingle();
    if (!data) return NextResponse.json({ ok: true, found: false });
    return NextResponse.json({
      ok: true,
      found: true,
      glTxId: data.gl_tx_id,
      oracleAddress: data.oracle_address,
      signedAt: data.signed_at,
      attempt: data.attempt
    });
  } catch (e) {
    return NextResponse.json({ ok: false, code: "unknown", error: (e as Error).message }, { status: 500 });
  }
}
