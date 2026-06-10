"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { workProofAbi, workProofAddress } from "@/lib/contracts";
import { EthAmount } from "@/components/shared/EthAmount";
import { useTx } from "@/components/shared/TxToast";
import type { Claim } from "@/lib/types";

export function ClaimCard({ claim }: { claim: Claim }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const { run } = useTx();
  const [claimed, setClaimed] = useState(claim.status === "claimed");

  async function claimReward() {
    const addr = workProofAddress;
    if (!addr) return;
    const args = [claim.job_id_onchain as `0x${string}`] as const;
    const hash = await run({
      label: "Claiming reward",
      pending: "Sending payout to your wallet…",
      success: "Reward in your wallet",
      // Pre-flight so DISPUTE_WINDOW / ALREADY_CLAIMED surface a friendly reason
      // instead of a raw on-chain revert.
      simulate: () => publicClient!.simulateContract({ address: addr, abi: workProofAbi, functionName: "claimReward", args, account: address }),
      write: () => writeContractAsync({
        address: addr,
        abi: workProofAbi,
        functionName: "claimReward",
        args
      })
    });
    if (!hash) return;
    setClaimed(true);
  }

  return (
    <div className="panel p-6 grid gap-3">
      <h3 className="text-lg font-bold">{claim.jobs?.title || "Claimable reward"}</h3>
      <div className="text-2xl font-black">
        <EthAmount wei={claim.reward_wei} />
      </div>
      <div className="text-sm text-muted">Quality score · {claim.quality_score ?? "—"}/100 · +{claim.reputation_pts ?? 0} XP</div>
      {claim.ai_summary && <p className="text-sm">{claim.ai_summary}</p>}
      {claimed ? (
        <span className="status-badge" data-state="complete"><span className="dot" /> Claimed</span>
      ) : (
        <button className="btn" disabled={isPending} onClick={claimReward}>{isPending ? "Claiming…" : "Claim Reward"}</button>
      )}
    </div>
  );
}
