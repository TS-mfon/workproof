// Server-side viem public client for API routes / cron. Read-only.
import { createPublicClient, http, type PublicClient } from "viem";
import { arbitrumSepolia } from "viem/chains";

let cached: PublicClient | null = null;

export function serverPublicClient(): PublicClient {
  if (cached) return cached;
  const rpc = process.env.ARBITRUM_SEPOLIA_RPC
    ?? process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC
    ?? "https://sepolia-rollup.arbitrum.io/rpc";
  cached = createPublicClient({ chain: arbitrumSepolia, transport: http(rpc) }) as PublicClient;
  return cached;
}

export function serverWorkProofAddress(): `0x${string}` | undefined {
  return (process.env.WORKPROOF_CONTRACT ?? process.env.NEXT_PUBLIC_WORKPROOF_CONTRACT) as `0x${string}` | undefined;
}
