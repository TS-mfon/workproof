import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { privateKeyToAccount } from "viem/accounts";

const WRITE_TIMEOUT_MS = 30_000;

export type SignVerifyResult =
  | { ok: true; glTxId: string; oracleAddress: string }
  | { ok: false; code: SignVerifyErrorCode; error: string };

export type SignVerifyErrorCode =
  | "oracle_misconfigured"
  | "rpc_unreachable"
  | "contract_revert"
  | "timeout"
  | "unknown";

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout:${label}`)), ms))
  ]);
}

let cachedOracleAddress: string | null = null;
export function loadOracleKey(): { key: `0x${string}`; address: string } | null {
  const raw = process.env.ORACLE_PRIVATE_KEY;
  if (!raw || !/^0x[0-9a-fA-F]{64}$/.test(raw)) return null;
  if (!cachedOracleAddress) {
    try {
      cachedOracleAddress = privateKeyToAccount(raw as `0x${string}`).address;
    } catch {
      return null;
    }
  }
  return { key: raw as `0x${string}`, address: cachedOracleAddress };
}

export function genLayerContract(): `0x${string}` | null {
  const v = (process.env.GENLAYER_CONTRACT ?? process.env.NEXT_PUBLIC_GENLAYER_CONTRACT) as
    | `0x${string}`
    | undefined;
  return v ?? null;
}

export async function signVerifySubmission(input: {
  jobId: string;
  submissionId: string;
  freelancer: string;
  deliverableUrl: string;
  criteria: string;
  attempt: number;
}): Promise<SignVerifyResult> {
  const oracle = loadOracleKey();
  const contract = genLayerContract();
  if (!oracle) {
    return { ok: false, code: "oracle_misconfigured", error: "ORACLE_PRIVATE_KEY missing or malformed" };
  }
  if (!contract) {
    return { ok: false, code: "oracle_misconfigured", error: "GENLAYER_CONTRACT missing" };
  }

  let account, client;
  try {
    account = createAccount(oracle.key);
    client = createClient({ chain: studionet, account });
  } catch (e) {
    return { ok: false, code: "oracle_misconfigured", error: `signer init failed: ${(e as Error).message}` };
  }

  try {
    const glTxId = (await withTimeout(
      client.writeContract({
        address: contract,
        functionName: "verify_submission",
        args: [
          `job:${input.jobId}`,
          `submission:${input.submissionId}`,
          `wallet:${input.freelancer}`,
          input.deliverableUrl,
          input.criteria,
          input.attempt
        ],
        value: 0n
      }) as Promise<string>,
      WRITE_TIMEOUT_MS,
      "writeContract"
    )) as string;
    return { ok: true, glTxId, oracleAddress: oracle.address };
  } catch (e) {
    const message = ((e as Error)?.message ?? "GenLayer write failed").toString();
    if (message.startsWith("timeout:")) return { ok: false, code: "timeout", error: message };
    if (/fetch failed|ECONN|ENOTFOUND|network/i.test(message))
      return { ok: false, code: "rpc_unreachable", error: message };
    if (/revert|execution|invalid opcode/i.test(message))
      return { ok: false, code: "contract_revert", error: message };
    return { ok: false, code: "unknown", error: message };
  }
}

export async function writeGenLayerAudit(row: {
  jobId: string;
  submissionId: string;
  glTxId: string;
  oracleAddress: string;
  attempt: number;
}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return;
  const res = await fetch(`${url}/rest/v1/genlayer_submissions`, {
    method: "POST",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      prefer: "return=minimal"
    },
    body: JSON.stringify({
      job_id: row.jobId,
      submission_id: row.submissionId,
      gl_tx_id: row.glTxId,
      oracle_address: row.oracleAddress,
      attempt: row.attempt
    })
  });
  if (!res.ok && res.status !== 409) {
    throw new Error(`supabase ${res.status}`);
  }
}

export async function rpcGenLayer(method: string, args: unknown[]) {
  const rpc = process.env.GENLAYER_STUDIO_RPC ?? "https://studio.genlayer.com/api";
  const contract = genLayerContract();
  if (!contract) throw new Error("GENLAYER_CONTRACT missing");
  const res = await withTimeout(
    fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method: "gen_callContractMethod",
        params: { contract, method, args }
      })
    }),
    20_000,
    `rpc:${method}`
  );
  if (!res.ok) throw new Error(`GenLayer ${method} HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(`GenLayer ${method} RPC error: ${body.error.message ?? "unknown"}`);
  return body.result;
}
