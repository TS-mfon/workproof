"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { arbitrumSepolia } from "viem/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "WorkProof",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "workproof-dev",
  chains: [arbitrumSepolia],
  ssr: true
});
