"use client";

import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { arbitrumSepolia } from "viem/chains";

export function WrongNetworkBanner() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected) return null;
  if (chainId === arbitrumSepolia.id) return null;

  return (
    <div className="wrong-network">
      <span>You're on the wrong network — WorkProof runs on Arbitrum Sepolia.</span>
      <button
        className="btn"
        disabled={isPending}
        onClick={() => switchChain({ chainId: arbitrumSepolia.id })}
      >
        {isPending ? "Switching…" : "Switch network"}
      </button>
    </div>
  );
}
