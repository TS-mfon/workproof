import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { recoverMessageAddress, type Address } from "viem";

const NONCE_COOKIE = "workproof.wallet_nonce";
const SESSION_COOKIE = "workproof.wallet_session";
const SESSION_SECONDS = 24 * 60 * 60;
const NONCE_SECONDS = 10 * 60;

type Token = { wallet?: string; nonce?: string; expiresAt: number };

function secret() {
  const value = process.env.WALLET_SESSION_SECRET ?? process.env.ORACLE_WEBHOOK_SECRET;
  if (!value || value.length < 32) throw new Error("WALLET_SESSION_SECRET must be at least 32 characters");
  return value;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function encode(payload: Token) {
  const value = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${value}.${sign(value)}`;
}

function decode(value?: string): Token | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as Token;
    return parsed.expiresAt > Math.floor(Date.now() / 1000) ? parsed : null;
  } catch {
    return null;
  }
}

export function walletLoginMessage(nonce: string) {
  return `Sign in to WorkProof\n\nNonce: ${nonce}\nChain: Arbitrum Sepolia (421614)\n\nThis signature does not submit a transaction or cost gas.`;
}

export async function issueWalletNonce() {
  const nonce = crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + NONCE_SECONDS;
  (await cookies()).set(NONCE_COOKIE, encode({ nonce, expiresAt }), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: NONCE_SECONDS
  });
  return { nonce, message: walletLoginMessage(nonce), expiresAt };
}

export async function createWalletSession(wallet: string, signature: `0x${string}`) {
  const store = await cookies();
  const nonceToken = decode(store.get(NONCE_COOKIE)?.value);
  if (!nonceToken?.nonce) throw new Error("Login nonce is missing or expired");
  const recovered = await recoverMessageAddress({ message: walletLoginMessage(nonceToken.nonce), signature });
  if (recovered.toLowerCase() !== wallet.toLowerCase()) throw new Error("Signature does not match wallet");
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  store.set(SESSION_COOKIE, encode({ wallet: recovered.toLowerCase(), expiresAt }), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_SECONDS
  });
  store.delete(NONCE_COOKIE);
  return { wallet: recovered.toLowerCase() as Address, expiresAt };
}

export async function requireWalletSession() {
  const token = decode((await cookies()).get(SESSION_COOKIE)?.value);
  if (!token?.wallet || !/^0x[0-9a-f]{40}$/.test(token.wallet)) return null;
  return { wallet: token.wallet as Address, expiresAt: token.expiresAt };
}

export async function clearWalletSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
