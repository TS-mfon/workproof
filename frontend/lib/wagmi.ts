"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { arbitrumSepolia } from "viem/chains";
import { cookieStorage, createStorage } from "wagmi";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
if (!walletConnectProjectId) {
  throw new Error("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required");
}

export const wagmiConfig = getDefaultConfig({
  appName: "WorkProof",
  projectId: walletConnectProjectId,
  chains: [arbitrumSepolia],
  ssr: true,
  storage: createStorage({ storage: cookieStorage, key: "wagmi.store" })
});
