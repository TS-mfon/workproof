"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { ClaimCard } from "@/components/claim/ClaimCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { workProofAbi, workProofAddress } from "@/lib/contracts";
import type { Claim } from "@/lib/types";

type ClaimJob = {
  jobId: `0x${string}`;
  assignedFreelancer: `0x${string}`;
  rewardAmount: bigint;
  status: number;
  verdictAt: bigint;
  title: string;
  domain: string;
};

export default function ClaimPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [claims, setClaims] = useState<Claim[] | null>(null);

  useEffect(() => {
    if (!address || !publicClient || !workProofAddress) { setClaims(null); return; }
    const contractAddress = workProofAddress;
    let alive = true;
    (async () => {
      const ids = await publicClient.readContract({ address: contractAddress, abi: workProofAbi, functionName: "getJobIds" });
      const jobs = await publicClient.multicall({
        allowFailure: true,
        contracts: ids.map((id) => ({ address: contractAddress, abi: workProofAbi, functionName: "getJob", args: [id] }))
      });
      if (!alive) return;
      const wallet = address.toLowerCase();
      setClaims(jobs.flatMap((result) => {
        if (result.status !== "success") return [];
        const job = result.result as unknown as ClaimJob;
        if (job.status !== 5 || job.assignedFreelancer.toLowerCase() !== wallet) return [];
        return [{
          id: job.jobId,
          job_id_onchain: job.jobId,
          freelancer_wallet: job.assignedFreelancer,
          reward_wei: job.rewardAmount.toString(),
          quality_score: null,
          ai_summary: "Client accepted this GenLayer-reviewed submission.",
          reputation_pts: null,
          status: "pending" as const,
          passed_at: new Date(Number(job.verdictAt) * 1000).toISOString(),
          claimed_at: null,
          jobs: { title: job.title, domain: job.domain }
        }];
      }));
    })().catch(() => { if (alive) setClaims([]); });
    return () => { alive = false; };
  }, [address, publicClient]);

  return (
    <section className="shell py-12">
      <div style={{ marginBottom: 32 }}>
        <p className="text-xs font-bold uppercase tracking-widest text-accent-strong">Earnings</p>
        <h1 style={{ fontSize: 36, fontWeight: 800, marginTop: 8 }}>Claim rewards</h1>
        <p className="text-sm text-muted" style={{ marginTop: 6 }}>Rewards accepted by clients and claimable directly from WorkProof V3.</p>
      </div>
      {!isConnected ? <EmptyState title="Connect a wallet" message="Connect your freelancer wallet to read claimable rewards directly from the contract." />
        : claims === null ? <div className="panel p-6 grid gap-3"><Skeleton height={24} width={200} /><Skeleton height={120} /></div>
        : claims.length === 0 ? <EmptyState title="No claimable rewards yet" message="A reward appears after the client accepts your submission." ctaLabel="Find a job" ctaHref="/jobs" />
        : <div className="grid-auto">{claims.map((claim) => <ClaimCard key={claim.id} claim={claim} />)}</div>}
    </section>
  );
}
