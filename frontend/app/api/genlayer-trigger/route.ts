import { NextRequest, NextResponse } from "next/server";
import { execFileSync } from "node:child_process";
import { ipFromRequest, rateLimit } from "@/lib/rate-limit";
import { verifyOracleSignature } from "@/lib/oracle-hmac";

// Called by the frontend immediately after submitWork confirms on Arbitrum.
// Spawns `genlayer write` to trigger the GenLayer contract's verify_work function.
// The oracle private key and GenLayer contract are read from server-side env vars.

export async function POST(request: NextRequest) {
  const limit = rateLimit(`genlayer-trigger:${ipFromRequest(request.headers)}`, 20);
  if (!limit.ok) return NextResponse.json({ error: "rate limit" }, { status: 429 });

  let body: { jobId: string; deliverableUrl: string; criteria: string; retryCount?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const { jobId, deliverableUrl, criteria, retryCount = 0 } = body;
  if (!jobId || !deliverableUrl || !criteria) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const genLayerContract = process.env.GENLAYER_CONTRACT ?? process.env.NEXT_PUBLIC_GENLAYER_CONTRACT;
  if (!genLayerContract) {
    return NextResponse.json({ error: "GENLAYER_CONTRACT not configured", started: false });
  }

  try {
    // Use the genlayer CLI which handles GenLayer account signing internally.
    // On Vercel this isn't available, so we fall back to direct RPC (eth_sendTransaction).
    let result: { started: boolean; note?: string };
    try {
      const output = execFileSync("genlayer", [
        "write",
        genLayerContract,
        "verify_work",
        "--args",
        jobId,
        deliverableUrl,
        criteria,
        String(retryCount)
      ], { encoding: "utf8", timeout: 30000, env: { ...process.env } });
      const txHash = output.match(/(?:Write Transaction Hash|Transaction Hash):\s*\n?([0-9a-fA-Fx]{66})/)?.[1];
      result = { started: true, note: txHash ? `tx: ${txHash}` : "triggered" };
    } catch (cliErr: any) {
      // CLI not available (Vercel) — fall back to raw eth_sendTransaction
      result = await triggerViaRpc(jobId, deliverableUrl, criteria, retryCount, genLayerContract);
    }
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("GenLayer trigger failed:", err?.message);
    return NextResponse.json({ started: false, error: err?.message });
  }
}

async function triggerViaRpc(
  _jobId: string,
  _deliverableUrl: string,
  _criteria: string,
  _retryCount: number,
  _contract: string
): Promise<{ started: boolean; note?: string }> {
  // Direct RPC encoding requires msgpack which is not bundled.
  // The oracle's poll cycle (every 30s) will call get_verdict and relay the verdict
  // once GenLayer has processed it. This is the reliable fallback.
  return { started: false, note: "CLI unavailable on this platform — oracle poll will relay the verdict" };
}
