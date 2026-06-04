"use client";

import { useCallback } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { ADMIN_DOMAIN, ADMIN_TYPES, randomNonce, type AdminPayload, buildAdminHeader } from "@/lib/auth";

export function useAdminSign() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const sign = useCallback(async (action: string, target: string): Promise<string | null> => {
    if (!address || !walletClient) return null;
    const payload: AdminPayload = {
      action,
      target,
      nonce: randomNonce(),
      expiresAt: Math.floor(Date.now() / 1000) + 300
    };
    const signature = await walletClient.signTypedData({
      account: address,
      domain: ADMIN_DOMAIN,
      types: ADMIN_TYPES,
      primaryType: "AdminAction",
      message: {
        action: payload.action,
        target: payload.target,
        nonce: payload.nonce,
        expiresAt: BigInt(payload.expiresAt)
      }
    });
    return buildAdminHeader(address, payload, signature as `0x${string}`);
  }, [address, walletClient]);

  return { sign, ready: !!address && !!walletClient };
}
