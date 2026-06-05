"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { createPublicClient, http } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { workProofAbi, workProofAddress } from "@/lib/contracts";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { JobsTable } from "@/components/dashboard/JobsTable";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { eth } from "@/lib/format";
import type { Activity, Job } from "@/lib/types";

function publicClient() {
  const rpc = process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC ?? "https://sepolia-rollup.arbitrum.io/rpc";
  return createPublicClient({ chain: arbitrumSepolia, transport: http(rpc) });
}

export function FreelancerDashboard() {
  const { address, isConnected } = useAccount();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!address || !workProofAddress) return;
    const pc = publicClient();
    let alive = true;
    (async () => {
      try {
        const [ids] = await Promise.all([
          pc.readContract({ address: workProofAddress as `0x${string}`, abi: workProofAbi, functionName: "getJobIds" }),
          ...([])
        ]);

        // Batch-check hasApplied for the last 50 Open jobs
        const recentIds = [...ids].reverse().slice(0, 50);
        const results = await pc.multicall({
          allowFailure: true,
          contracts: recentIds.map((jid) => ({
            address: workProofAddress as `0x${string}`,
            abi: workProofAbi,
            functionName: "hasApplied",
            args: [jid, address]
          }))
        });
        if (!alive) return;
        const applied = new Set<string>();
        results.forEach((r, i) => {
          if (r.status === "success" && r.result === true) {
            applied.add(recentIds[i]);
          }
        });
        setAppliedIds(applied);
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [address]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [jobsRes, actsRes] = await Promise.all([
          fetch("/api/jobs").then((r) => r.json()),
          fetch("/api/activity").then((r) => r.json())
        ]);
        if (!alive) return;
        setJobs(jobsRes.jobs ?? []);
        setActivities(actsRes.activities ?? []);
      } catch {
        if (alive) { setJobs([]); setActivities([]); }
      }
    })();
    return () => { alive = false; };
  }, []);

  const wallet = address?.toLowerCase();

  const myJobs = useMemo(() => {
    if (!wallet || !jobs) return null;
    return jobs.filter((j) =>
      j.freelancer_wallet?.toLowerCase() === wallet ||
      j.assigned_to_wallet?.toLowerCase() === wallet
    );
  }, [jobs, wallet]);

  const myApps = useMemo(() => {
    if (!jobs || appliedIds.size === 0) return [];
    return jobs.filter((j) => appliedIds.has(j.job_id_onchain) && j.status === "Open");
  }, [jobs, appliedIds]);

  const myActivities = useMemo(() => {
    if (!wallet || !activities) return null;
    return activities.filter((a) => a.actor_wallet?.toLowerCase() === wallet);
  }, [activities, wallet]);

  if (!isConnected || !address) {
    return (
      <EmptyState
        title="Connect a wallet"
        message="Connect your wallet to see jobs you've applied for and your earnings."
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

  const active = myJobs.filter((j) => j.status === "Active" || j.status === "UnderReview");
  const claimable = myJobs.filter((j) => j.status === "Passed");
  const retry = myJobs.filter((j) => j.status === "Failed" && j.retry_count < 3);
  const completed = myJobs.filter((j) => j.status === "Complete");

  const stats = [
    { label: "Pending applications", value: myApps.length.toString() },
    { label: "Active jobs", value: active.length.toString() },
    { label: "Claimable", value: claimable.length.toString() },
    { label: "Total earned", value: eth(completed.reduce((s, j) => s + BigInt(j.reward_amount_wei || "0"), 0n)) }
  ];

  return (
    <div className="grid gap-8">
      <StatsRow stats={stats} />

      <section className="grid gap-3">
        <h2 className="text-xl font-bold">Pending applications</h2>
        <p className="text-sm text-muted" style={{ marginTop: 2, marginBottom: 4 }}>
          Jobs you've applied to that are still awaiting client acceptance.
        </p>
        {myApps.length === 0 ? (
          <EmptyState
            title="No pending applications"
            message="Apply for an open job to get started."
            ctaLabel="Browse jobs"
            ctaHref="/jobs"
          />
        ) : (
          <JobsTable jobs={myApps} />
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-bold">Active jobs</h2>
        {active.length === 0 ? (
          <EmptyState title="No active jobs" message="Once the client accepts your application, the job appears here." />
        ) : (
          <JobsTable jobs={active} />
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-bold">Claimable rewards</h2>
        {claimable.length === 0 ? (
          <EmptyState title="Nothing to claim" message="Pass an AI review and the payout appears here." />
        ) : (
          <JobsTable jobs={claimable} />
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-bold">Needs retry</h2>
        {retry.length === 0 ? (
          <EmptyState title="No failed attempts" />
        ) : (
          <JobsTable jobs={retry} />
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-bold">Completed</h2>
        {completed.length === 0 ? (
          <EmptyState title="No completions yet" message="Your finished jobs and earnings show here." />
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
