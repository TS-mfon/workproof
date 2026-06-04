"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { ClaimCard } from "@/components/claim/ClaimCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import type { Claim } from "@/lib/types";

export default function ClaimPage() {
  const { address, isConnected } = useAccount();
  const [claims, setClaims] = useState<Claim[] | null>(null);

  useEffect(() => {
    if (!address) { setClaims(null); return; }
    fetch(`/api/jobs?claimsFor=${address}`)
      .then((r) => r.json())
      .then((body) => setClaims(body.claims ?? []))
      .catch(() => setClaims([]));
  }, [address]);

  return (
    <section className="shell py-12">
      <div style={{ marginBottom: 32 }}>
        <p className="text-xs font-bold uppercase tracking-widest text-accent-strong">Earnings</p>
        <h1 style={{ fontSize: 36, fontWeight: 800, marginTop: 8 }}>Claim rewards</h1>
        <p className="text-sm text-muted" style={{ marginTop: 6 }}>
          Jobs the AI verifier passed for you. Click claim and the payout transfers to your wallet.
        </p>
      </div>

      {!isConnected ? (
        <EmptyState
          title="Connect a wallet"
          message="Connect the freelancer wallet that submitted the work to see your claimable rewards."
        />
      ) : claims === null ? (
        <div className="panel p-6 grid gap-3">
          <Skeleton height={24} width={200} />
          <Skeleton height={120} />
        </div>
      ) : claims.length === 0 ? (
        <EmptyState
          title="No claimable rewards yet"
          message="Once the AI verifier passes one of your submissions, it shows up here."
          ctaLabel="Find a job"
          ctaHref="/jobs"
        />
      ) : (
        <div className="grid-auto">
          {claims.map((claim) => <ClaimCard key={claim.id} claim={claim} />)}
        </div>
      )}
    </section>
  );
}
