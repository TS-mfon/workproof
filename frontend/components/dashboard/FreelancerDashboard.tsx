"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { JobsTable } from "@/components/dashboard/JobsTable";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { eth } from "@/lib/format";
import type { Activity, Job } from "@/lib/types";

export function FreelancerDashboard() {
  const { address, isConnected } = useAccount();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [activities, setActivities] = useState<Activity[] | null>(null);

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

  const filtered = useMemo(() => {
    if (!wallet || !jobs) return null;
    return jobs.filter((j) =>
      j.freelancer_wallet?.toLowerCase() === wallet ||
      j.assigned_to_wallet?.toLowerCase() === wallet
    );
  }, [jobs, wallet]);

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

  if (filtered === null) {
    return (
      <div className="panel p-6 grid gap-3">
        <Skeleton height={24} width={240} />
        <Skeleton height={120} />
      </div>
    );
  }

  const active = filtered.filter((j) => j.status === "Active" || j.status === "UnderReview");
  const claimable = filtered.filter((j) => j.status === "Passed");
  const retry = filtered.filter((j) => j.status === "Failed" && j.retry_count < 3);
  const completed = filtered.filter((j) => j.status === "Complete");

  const stats = [
    { label: "Active jobs", value: active.length.toString() },
    { label: "Claimable", value: claimable.length.toString() },
    { label: "Completed", value: completed.length.toString() },
    { label: "Total earned", value: eth(completed.reduce((s, j) => s + BigInt(j.reward_amount_wei || "0"), 0n)) }
  ];

  return (
    <div className="grid gap-8">
      <StatsRow stats={stats} />

      <section className="grid gap-3">
        <h2 className="text-xl font-bold">Active jobs</h2>
        {active.length === 0 ? (
          <EmptyState
            title="No active jobs"
            message="Apply for a job to get started."
            ctaLabel="Browse jobs"
            ctaHref="/jobs"
          />
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
