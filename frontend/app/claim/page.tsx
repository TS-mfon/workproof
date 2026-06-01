"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { ClaimCard } from "@/components/claim/ClaimCard";
import type { Claim } from "@/lib/types";

export default function ClaimPage() {
  const { address } = useAccount();
  const [claims, setClaims] = useState<Claim[]>([]);
  useEffect(() => {
    if (!address) return;
    fetch(`/api/jobs?claimsFor=${address}`).then((r) => r.json()).then((body) => setClaims(body.claims ?? []));
  }, [address]);
  return (
    <section className="shell py-10">
      <h1 className="mb-6 text-3xl font-black">Claim Rewards</h1>
      {!address && <div className="panel p-6">Connect wallet to view rewards.</div>}
      {address && claims.length === 0 && <div className="panel p-6">No rewards to claim yet. Complete a job to earn rewards.</div>}
      <div className="grid-auto">{claims.map((claim) => <ClaimCard key={claim.id} claim={claim} />)}</div>
    </section>
  );
}
