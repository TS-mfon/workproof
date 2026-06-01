"use client";

import { useState } from "react";
import { useWriteContract } from "wagmi";
import { workProofAbi, workProofAddress } from "@/lib/contracts";
import { EthAmount } from "@/components/shared/EthAmount";
import type { Claim } from "@/lib/types";

export function ClaimCard({ claim }: { claim: Claim }) {
  const { writeContractAsync, isPending } = useWriteContract();
  const [message, setMessage] = useState("");
  async function claimReward() {
    if (!workProofAddress) return setMessage("Contract address missing.");
    const hash = await writeContractAsync({ address: workProofAddress, abi: workProofAbi, functionName: "claimReward", args: [claim.job_id_onchain as `0x${string}`] });
    await fetch("/api/jobs", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ job_id_onchain: claim.job_id_onchain, status: "Complete", claim_id: claim.id, tx_hash: hash })
    });
    setMessage(`Claim submitted: ${hash}`);
  }
  return (
    <div className="panel p-5">
      <h3 className="text-xl font-bold">{claim.jobs?.title || claim.job_id_onchain}</h3>
      <p className="mt-2"><EthAmount wei={claim.reward_wei} /> reward</p>
      <p className="text-sm text-slate-600">Quality score: {claim.quality_score ?? "pending"}/100</p>
      <p className="mt-2 text-sm">{claim.ai_summary}</p>
      <p className="mt-2 text-sm font-bold">Reputation: +{claim.reputation_pts ?? 0}</p>
      {claim.status === "pending" ? <button className="btn mt-4" disabled={isPending} onClick={claimReward}>Claim Reward</button> : <p className="mt-4 font-bold">Claimed</p>}
      {message && <p className="mt-3 text-sm text-slate-700">{message}</p>}
    </div>
  );
}
