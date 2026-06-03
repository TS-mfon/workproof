"use client";

import { useState } from "react";
import { useWriteContract } from "wagmi";
import { workProofAbi, workProofAddress } from "@/lib/contracts";
import { EthAmount } from "@/components/shared/EthAmount";
import { useTx } from "@/components/shared/TxToast";
import type { Claim } from "@/lib/types";

export function ClaimCard({ claim }: { claim: Claim }) {
  const { writeContractAsync, isPending } = useWriteContract();
  const { run } = useTx();
  const [claimed, setClaimed] = useState(claim.status === "claimed");

  async function claimReward() {
    const addr = workProofAddress;
    if (!addr) return;
    const hash = await run({
      label: "Claiming reward",
      pending: "Sending payout to your wallet…",
      success: "Reward in your wallet",
      write: () => writeContractAsync({
        address: addr,
        abi: workProofAbi,
        functionName: "claimReward",
        args: [claim.job_id_onchain as `0x${string}`]
      })
    });
    if (!hash) return;
    setClaimed(true);
    fetch("/api/jobs", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ job_id_onchain: claim.job_id_onchain, status: "Complete", claim_id: claim.id, tx_hash: hash })
    }).catch(() => {});
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
