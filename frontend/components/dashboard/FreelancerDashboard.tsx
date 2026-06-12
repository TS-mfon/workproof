"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { createPublicClient, http, type PublicClient } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { workProofAddress } from "@/lib/contracts";
import {
  chainJobToJob,
  readAllJobsBestEffort,
  readApplicants,
  readJobSubmissions,
  readProfile,
  readSubmission
} from "@/lib/workproof-reads";
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

export function FreelancerDashboard() {
  const { address, isConnected } = useAccount();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());
  const [totalEarnedWei, setTotalEarnedWei] = useState("0");
  const [loadError, setLoadError] = useState("");

  // CHAIN-AUTHORITATIVE: read every job from the contract and check applicant
  // lists on-chain. The DB is only used to enrich descriptions + the activity feed.
  useEffect(() => {
    if (!address || !workProofAddress) { setJobs([]); return; }
    const pc = publicClient();
    let alive = true;
    (async () => {
      try {
        setLoadError("");
        const [chainJobs, dbRes, profile] = await Promise.all([
          readAllJobsBestEffort(pc),
          fetch("/api/jobs").then((r) => r.json()).catch(() => ({ jobs: [] })),
          readProfile(pc, address).catch(() => null)
        ]);
        if (!alive) return;
        setTotalEarnedWei(profile?.totalEarned.toString() ?? "0");
        const dbById = new Map<string, Record<string, unknown>>(
          (dbRes.jobs ?? []).map((d: Record<string, unknown>) => [String(d.job_id_onchain).toLowerCase(), d])
        );
        const mapped = chainJobs.map((cj) => chainJobToJob(cj, dbById.get(cj.jobId.toLowerCase())));
        setJobs(mapped);

        // Application and submission membership straight from chain. Competitive
        // jobs have no assigned freelancer until a winner is approved, so their
        // submissions must be included explicitly.
        const openIds = chainJobs.filter((j) => j.status === 0).map((j) => j.jobId);
        const applied = new Set<string>();
        const submitted = new Set<string>();
        await Promise.all(openIds.map(async (jid) => {
          try {
            const apps = await readApplicants(pc, jid);
            if (apps.some((a) => a.toLowerCase() === address.toLowerCase())) applied.add(jid);
          } catch { /* ignore */ }
        }));
        await Promise.all(chainJobs.map(async (job) => {
          try {
            const submissionIds = await readJobSubmissions(pc, job.jobId);
            const submissions = await Promise.all(submissionIds.map((id) => readSubmission(pc, id).catch(() => null)));
            if (submissions.some((submission) => submission?.freelancer.toLowerCase() === address.toLowerCase())) {
              submitted.add(job.jobId);
            }
          } catch { /* preserve other dashboard data */ }
        }));
        if (alive) {
          setAppliedIds(applied);
          setSubmittedIds(submitted);
        }
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
    return jobs.filter((j) =>
      j.freelancer_wallet?.toLowerCase() === wallet ||
      j.assigned_to_wallet?.toLowerCase() === wallet ||
      submittedIds.has(j.job_id_onchain)
    );
  }, [jobs, wallet, submittedIds]);

  const myApps = useMemo(() => {
    if (!jobs || appliedIds.size === 0) return [];
    const lowApplied = new Set([...appliedIds].map((x) => x.toLowerCase()));
    return jobs.filter((j) => lowApplied.has(j.job_id_onchain.toLowerCase()) && j.status === "Open");
  }, [jobs, appliedIds]);

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

  const active = myJobs.filter((j) =>
    j.status === "Active" ||
    j.status === "UnderReview" ||
    j.status === "AwaitingApproval" ||
    (j.status === "Open" && submittedIds.has(j.job_id_onchain))
  );
  const claimable = myJobs.filter((j) => j.status === "Passed");
  const retry = myJobs.filter((j) => j.status === "Failed" && j.retry_count < 3);
  const completed = myJobs.filter((j) => j.status === "Complete");

  const stats = [
    { label: "Pending applications", value: myApps.length.toString() },
    { label: "Active jobs", value: active.length.toString() },
    { label: "Claimable", value: claimable.length.toString() },
    { label: "Total earned", value: eth(BigInt(totalEarnedWei || "0")) }
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
