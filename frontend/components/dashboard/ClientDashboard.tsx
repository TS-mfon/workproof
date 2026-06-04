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

export function ClientDashboard() {
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

  const myJobs = useMemo(() => {
    if (!wallet || !jobs) return null;
    return jobs.filter((j) => j.client_wallet.toLowerCase() === wallet);
  }, [jobs, wallet]);

  const myActivities = useMemo(() => {
    if (!wallet || !activities) return null;
    return activities.filter((a) => a.actor_wallet?.toLowerCase() === wallet);
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
  const completed = myJobs.filter((j) => j.status === "Complete");
  const refunded = myJobs.filter((j) => j.status === "Refunded");

  const escrowed = myJobs
    .filter((j) => !["Complete", "Refunded", "Deleted"].includes(j.status))
    .reduce((s, j) => s + BigInt(j.escrow_amount_wei || "0"), 0n);

  const stats = [
    { label: "Total posted", value: myJobs.length.toString() },
    { label: "Open / In progress", value: (open.length + active.length).toString() },
    { label: "Locked in escrow", value: eth(escrowed) },
    { label: "Completed", value: completed.length.toString() }
  ];

  return (
    <div className="grid gap-8">
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
