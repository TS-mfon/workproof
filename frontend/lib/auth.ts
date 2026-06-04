import { recoverTypedDataAddress, type Address } from "viem";
import type { WalletClient } from "viem";

export const ADMIN_DOMAIN = {
  name: "WorkProof Admin",
  version: "1",
  chainId: 421614
} as const;

export const ADMIN_TYPES = {
  AdminAction: [
    { name: "action", type: "string" },
    { name: "target", type: "string" },
    { name: "nonce", type: "string" },
    { name: "expiresAt", type: "uint256" }
  ]
} as const;

export type AdminPayload = {
  action: string;
  target: string;
  nonce: string;
  expiresAt: number;
};

function toTypedMessage(payload: AdminPayload) {
  return {
    action: payload.action,
    target: payload.target,
    nonce: payload.nonce,
    expiresAt: BigInt(payload.expiresAt)
  };
}

export async function signAdminAction(walletClient: WalletClient, account: Address, payload: AdminPayload) {
  const sig = await walletClient.signTypedData({
    account,
    domain: ADMIN_DOMAIN,
    types: ADMIN_TYPES,
    primaryType: "AdminAction",
    message: toTypedMessage(payload)
  });
  const header = `Wallet ${account}:${JSON.stringify(payload)}:${sig}`;
  return header;
}

export function buildAdminHeader(account: Address, payload: AdminPayload, signature: `0x${string}`) {
  return `Wallet ${account}:${JSON.stringify(payload)}:${signature}`;
}

function parseAdminHeader(headerValue: string | null) {
  if (!headerValue || !headerValue.startsWith("Wallet ")) return null;
  const rest = headerValue.slice("Wallet ".length);
  const firstColon = rest.indexOf(":");
  const lastColon = rest.lastIndexOf(":");
  if (firstColon === -1 || lastColon === firstColon) return null;
  const wallet = rest.slice(0, firstColon).trim();
  const payloadJson = rest.slice(firstColon + 1, lastColon);
  const signature = rest.slice(lastColon + 1).trim();
  if (!wallet.startsWith("0x") || !signature.startsWith("0x")) return null;
  try {
    const payload = JSON.parse(payloadJson) as AdminPayload;
    return { wallet: wallet as Address, payload, signature: signature as `0x${string}` };
  } catch {
    return null;
  }
}

const allowedAdmins = () =>
  (process.env.ADMIN_WALLETS || process.env.NEXT_PUBLIC_ADMIN_WALLETS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

// In-memory nonce store. For multi-instance, swap for a Supabase table later.
const usedNonces = new Map<string, number>();

setInterval(() => {
  const now = Date.now();
  for (const [k, exp] of usedNonces) if (exp < now) usedNonces.delete(k);
}, 60_000).unref?.();

export async function verifyAdminAction(
  authHeader: string | null,
  expectedAction: string
): Promise<{ wallet: Address; payload: AdminPayload } | { error: string }> {
  const parsed = parseAdminHeader(authHeader);
  if (!parsed) return { error: "missing or malformed Authorization header" };

  const { wallet, payload, signature } = parsed;
  if (payload.action !== expectedAction) return { error: `action mismatch (expected ${expectedAction})` };

  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.expiresAt < nowSec) return { error: "signature expired" };
  if (payload.expiresAt > nowSec + 600) return { error: "signature too far in the future" };

  const nonceKey = `${wallet.toLowerCase()}:${payload.nonce}`;
  if (usedNonces.has(nonceKey)) return { error: "nonce already used" };

  if (!allowedAdmins().includes(wallet.toLowerCase())) return { error: "wallet not in admin allowlist" };

  try {
    const recovered = await recoverTypedDataAddress({
      domain: ADMIN_DOMAIN,
      types: ADMIN_TYPES,
      primaryType: "AdminAction",
      message: toTypedMessage(payload),
      signature
    });
    if (recovered.toLowerCase() !== wallet.toLowerCase()) return { error: "signature does not match wallet" };
  } catch (err: any) {
    return { error: `signature recovery failed: ${err?.message ?? "unknown"}` };
  }

  usedNonces.set(nonceKey, (payload.expiresAt + 60) * 1000);
  return { wallet, payload };
}

export function randomNonce() {
  if (typeof crypto !== "undefined" && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
