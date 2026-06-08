import { arbitrumSepolia } from "viem/chains";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC ?? "https://sepolia-rollup.arbitrum.io/rpc";

// RELAY_PRIVATE_KEY (Arbitrum receiveVerdict / autoRefund) can be set separately
// from ORACLE_PRIVATE_KEY (GenLayer verify_submission). Defaults to ORACLE_PRIVATE_KEY.
const relayKey = (process.env.RELAY_PRIVATE_KEY ?? process.env.ORACLE_PRIVATE_KEY) as
  | `0x${string}`
  | undefined;

export function arbitrumPublicClient() {
  return createPublicClient({
    chain: arbitrumSepolia,
    transport: http(rpcUrl)
  });
}

export function arbitrumWalletClient() {
  if (!relayKey || !/^0x[0-9a-fA-F]{64}$/.test(relayKey)) {
    throw new Error("relay key missing: set RELAY_PRIVATE_KEY or ORACLE_PRIVATE_KEY");
  }
  const account = privateKeyToAccount(relayKey);
  return createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(rpcUrl)
  });
}

export function relayAddress(): string | null {
  if (!relayKey || !/^0x[0-9a-fA-F]{64}$/.test(relayKey)) return null;
  return privateKeyToAccount(relayKey).address;
}

export const workProofAddress = (process.env.WORKPROOF_CONTRACT ??
  process.env.NEXT_PUBLIC_WORKPROOF_CONTRACT) as `0x${string}` | undefined;
