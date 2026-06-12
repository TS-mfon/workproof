"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { createPublicClient, http, type PublicClient } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { workProofAddress } from "@/lib/contracts";
import { chainJobToJob, readAllJobsBestEffort } from "@/lib/workproof-reads";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { JobsTable } from "@/components/dashboard/JobsTable";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { eth } from "@/lib/format";
import type { Activity, Job } from "@/lib/types";

function publicClient(): PublicClient {
  const rpc = process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC ?? "https://sepolia-rollup.arbitrum.io/rpc";
  return createPublicClient({ chain: arbitrumSepolia, transport: http(rpc) }) as PublicClient;
}

export function ClientDashboard() {
  const { address, isConnected } = useAccount();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [loadError, setLoadError] = useState("");

  // CHAIN-AUTHORITATIVE: read all jobs from the contract; DB enriches descriptions.
  useEffect(() => {
    if (!workProofAddress) { setJobs([]); return; }
    const pc = publicClient();
    let alive = true;
    (async () => {
      try {
        setLoadError("");
        const [chainJobs, dbRes] = await Promise.all([
          readAllJobsBestEffort(pc),
          fetch("/api/jobs").then((r) => r.json()).catch(() => ({ jobs: [] }))
        ]);
        if (!alive) return;
        const dbById = new Map<string, Record<string, unknown>>(
          (dbRes.jobs ?? []).map((d: Record<string, unknown>) => [String(d.job_id_onchain).toLowerCase(), d])
        );
        setJobs(chainJobs.map((cj) => chainJobToJob(cj, dbById.get(cj.jobId.toLowerCase()))));
      } catch (error) {
        if (alive) {
          setJobs([]);
          setLoadError(error instanceof Error ? error.message : "Could not read the WorkProof contract");
        }
      }
    })();
    return () => { alive = false; };
  }, [address]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/activity${address ? `?wallet=${address}` : ""}`).then((r) => r.json())
      .then((res) => { if (alive) setActivities(res.activities ?? []); })
      .catch(() => { if (alive) setActivities([]); });
    return () => { alive = false; };
  }, [address]);

  const wallet = address?.toLowerCase();

  const myJobs = useMemo(() => {
    if (!wallet || !jobs) return null;
    return jobs.filter((j) => j.client_wallet.toLowerCase() === wallet);
  }, [jobs, wallet]);

  const myActivities = useMemo(() => {
    if (!wallet || !activities) return null;
    return activities.filter((a) =>
      a.actor_wallet?.toLowerCase() === wallet ||
      a.target_wallet?.toLowerCase() === wallet
    );
  }, [activities, wallet]);

  if (!isConnected || !address) {
    return (
      <EmptyState
        title="Connect a wallet"
        message="Connect the wallet you posted jobs from to see your dashboard."
      />
    );
  }

  if (myJobs === null) {
    return (
      <div className="panel p-6 grid gap-3">
        <Skeleton height={24} width={240} />
        <Skeleton height={120} />
      </div>
    );
  }

  const open = myJobs.filter((j) => j.status === "Open");
  const active = myJobs.filter((j) => j.status === "Active");
  const review = myJobs.filter((j) => j.status === "UnderReview");
  const awaiting = myJobs.filter((j) => j.status === "AwaitingApproval");
  const completed = myJobs.filter((j) => j.status === "Complete");
  const refunded = myJobs.filter((j) => j.status === "Refunded");

  const escrowed = myJobs
    .filter((j) => !["Complete", "Refunded", "Deleted"].includes(j.status))
    .reduce((s, j) => s + BigInt(j.escrow_amount_wei || "0"), 0n);

  const stats = [
    { label: "Total posted", value: myJobs.length.toString() },
    { label: "Open / In progress", value: (open.length + active.length + review.length + awaiting.length).toString() },
    { label: "Locked in escrow", value: eth(escrowed) },
    { label: "Completed", value: completed.length.toString() }
  ];

  return (
    <div className="grid gap-8">
      {loadError && (
        <div className="panel p-4 text-sm" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
          Contract data could not be loaded: {loadError}. Check the selected network and retry.
        </div>
      )}
      <StatsRow stats={stats} />

      <section className="grid gap-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-xl font-bold">My jobs</h2>
          <a className="btn ghost tiny" href="/jobs/post">Post a new job</a>
        </div>
        {myJobs.length === 0 ? (
          <EmptyState
            title="No jobs posted yet"
            message="Post your first job to start using WorkProof."
            ctaLabel="Post a job"
            ctaHref="/jobs/post"
          />
        ) : (
          <JobsTable jobs={myJobs} />
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-bold">Open — awaiting applicants</h2>
        <p className="text-sm text-muted" style={{ marginTop: 2, marginBottom: 4 }}>
          Jobs with no assigned freelancer yet. Click Open to review and accept applicants.
        </p>
        {open.length === 0 ? (
          <EmptyState title="No open jobs" />
        ) : (
          <JobsTable jobs={open} />
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-bold">Under AI review</h2>
        {review.length === 0 ? (
          <EmptyState title="Nothing under review" message="Submissions awaiting GenLayer verdict will show here." />
        ) : (
          <JobsTable jobs={review} />
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-bold">Awaiting your approval</h2>
        <p className="text-sm text-muted" style={{ marginTop: 2, marginBottom: 4 }}>
          These submissions passed AI review. Open the job and approve the work to release the reward to the freelancer.
        </p>
        {awaiting.length === 0 ? (
          <EmptyState title="Nothing awaiting approval" message="Passed submissions that need your sign-off appear here." />
        ) : (
          <JobsTable jobs={awaiting} />
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-bold">Completed</h2>
        {completed.length === 0 ? (
          <EmptyState title="No completions yet" />
        ) : (
          <JobsTable jobs={completed} />
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-bold">My activity</h2>
        {myActivities && myActivities.length > 0 ? (
          <ActivityFeed activities={myActivities} />
        ) : (
          <EmptyState title="No activity yet" />
        )}
      </section>
    </div>
  );
}
