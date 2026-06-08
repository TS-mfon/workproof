import "dotenv/config";

const TX_HASH = process.argv[2] ?? "0xca7638d5b22f1752cdb7c896146e6178b2e8bb69d2987400ac08327dd8b08cb9";
const RPC = process.env.GENLAYER_STUDIO_RPC ?? "https://studio.genlayer.com/api";

async function rpc(method: string, params: unknown) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method, params })
  });
  const body = await res.json().catch(() => ({ raw: "non-json response" }));
  return { httpStatus: res.status, body };
}

async function main() {
  console.log(`Inspecting GenLayer tx: ${TX_HASH}`);
  console.log(`RPC: ${RPC}\n`);

  const candidates: Array<{ method: string; params: unknown }> = [
    { method: "gen_getTransactionByHash", params: { hash: TX_HASH } },
    { method: "gen_getTransactionByHash", params: [TX_HASH] },
    { method: "eth_getTransactionByHash", params: [TX_HASH] },
    { method: "gen_getTransactionReceipt", params: { hash: TX_HASH } },
    { method: "gen_getTransactionReceipt", params: [TX_HASH] },
    { method: "eth_getTransactionReceipt", params: [TX_HASH] }
  ];

  for (const c of candidates) {
    try {
      const r = await rpc(c.method, c.params);
      const ok = r.httpStatus === 200 && !(r.body as { error?: unknown }).error;
      console.log(`[${ok ? "OK" : "ERR"}] ${c.method} ${JSON.stringify(c.params)}`);
      console.log(JSON.stringify(r.body, null, 2));
      console.log("---");
    } catch (err) {
      console.log(`[THROW] ${c.method}: ${(err as Error).message}`);
    }
  }
}

main().catch((err) => {
  console.error("inspect-genlayer-tx failed:", err);
  process.exitCode = 1;
});
