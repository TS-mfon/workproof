import { arbitrumSepolia } from "viem/chains";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "../config.js";

export const account = privateKeyToAccount(env.ORACLE_PRIVATE_KEY as `0x${string}`);

export const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(env.ARBITRUM_SEPOLIA_RPC)
});

export const walletClient = createWalletClient({
  account,
  chain: arbitrumSepolia,
  transport: http(env.ARBITRUM_SEPOLIA_RPC)
});
