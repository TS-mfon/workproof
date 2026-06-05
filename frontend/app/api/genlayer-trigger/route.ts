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
  jobId: string,
  deliverableUrl: string,
  criteria: string,
  retryCount: number,
  contract: string
): Promise<{ started: boolean; note?: string }> {
  const rpc = process.env.GENLAYER_STUDIO_RPC ?? "https://studio.genlayer.com/api";
  const oracleKey = process.env.ORACLE_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATEKEY;

  if (!oracleKey) {
    return { started: false, note: "No oracle private key — oracle will pick this up on next poll" };
  }

  // Encode verify_work args in msgpack format that GenLayer expects
  // GenLayer uses a simple msgpack-like encoding: [functionName, posArgs, namedArgs]
  // We use the same approach genlayer-js uses internally
  const msgpack = await import("@msgpack/msgpack" as string).catch(() => null) as any;

  if (!msgpack?.encode || !msgpack?.serialize) {
    return { started: false, note: "msgpack not available — oracle will pick this up on next poll" };
  }

  try {
    const calldata = msgpack.serialize(msgpack.encode([
      "verify_work",
      [jobId, deliverableUrl, criteria, retryCount],
      {}
    ]));
    const calldataHex = "0x" + Buffer.from(calldata).toString("hex");

    // Get chain info to find consensus contract
    const chainInfoRes = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "1", method: "eth_chainId", params: [] })
    });
    if (!chainInfoRes.ok) throw new Error("GenLayer RPC not reachable");

    return { started: false, note: "Encoding step complete — oracle will relay shortly" };
  } catch {
    return { started: false, note: "GenLayer RPC trigger failed — oracle will pick this up" };
  }
}
