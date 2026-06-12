"use client";

import { useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";

export function useWalletSession() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const ensureSession = useCallback(async () => {
    if (!address) throw new Error("Connect a wallet first");
    const check = await fetch("/api/auth/session", { cache: "no-store" });
    const current = await check.json().catch(() => ({}));
    if (check.ok && current.wallet?.toLowerCase() === address.toLowerCase()) return address;

    const nonceRes = await fetch("/api/auth/nonce", { method: "POST" });
    const nonce = await nonceRes.json();
    if (!nonceRes.ok || !nonce.message) throw new Error(nonce.error ?? "Could not create login nonce");
    const signature = await signMessageAsync({ message: nonce.message });
    const verifyRes = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet: address, signature })
    });
    const verified = await verifyRes.json().catch(() => ({}));
    if (!verifyRes.ok) throw new Error(verified.error ?? "Wallet authentication failed");
    return address;
  }, [address, signMessageAsync]);

  return { address, ensureSession };
}
