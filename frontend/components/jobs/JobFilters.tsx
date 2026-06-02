"use client";

import { useMemo, useState } from "react";
import type { Job } from "@/lib/types";
import { JobCard } from "./JobCard";

export function JobFilters({ jobs }: { jobs: Job[] }) {
  const [domain, setDomain] = useState("All");
  const [status, setStatus] = useState("All");
  const [assigned, setAssigned] = useState("All");
  const [sort, setSort] = useState("Newest");
  const [maxEth, setMaxEth] = useState("100");

  const filtered = useMemo(() => {
    return jobs
      .filter((job) => domain === "All" || job.domain === domain)
      .filter((job) => status === "All" || job.status === status)
      .filter((job) => assigned === "All" || (assigned === "Open" ? !job.assigned_to_wallet : Boolean(job.assigned_to_wallet)))
      .filter((job) => Number(BigInt(job.reward_amount_wei || "0") / 10n ** 18n) <= Number(maxEth))
      .sort((a, b) => {
        if (sort === "Highest Reward") return Number(BigInt(b.reward_amount_wei) - BigInt(a.reward_amount_wei));
        if (sort === "Soonest Deadline") return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [assigned, domain, jobs, maxEth, sort, status]);

  return (
    <div>
      <div className="panel mb-6 grid gap-3 p-4 md:grid-cols-5">
        <select className="select" value={domain} onChange={(e) => setDomain(e.target.value)}>
          {["All", "smart-contracts", "frontend", "design", "content", "marketing"].map((value) => <option key={value}>{value}</option>)}
        </select>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          {["All", "Open", "Active"].map((value) => <option key={value}>{value}</option>)}
        </select>
        <select className="select" value={assigned} onChange={(e) => setAssigned(e.target.value)}>
          <option>All</option><option>Open</option><option>Direct Allocation</option>
        </select>
        <input className="input" type="number" min="0" value={maxEth} onChange={(e) => setMaxEth(e.target.value)} aria-label="Maximum ETH" />
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
          {["Newest", "Highest Reward", "Soonest Deadline"].map((value) => <option key={value}>{value}</option>)}
        </select>
      </div>
      {filtered.length === 0 ? (
        <div className="panel p-10 text-center">
          <h2 className="text-2xl font-black uppercase tracking-[0.08em] text-white">No job posted yet</h2>
          <a className="btn mt-4" href="/jobs/post">Post the first job</a>
        </div>
      ) : (
        <div className="grid-auto">{filtered.map((job) => <JobCard key={job.job_id_onchain} job={job} />)}</div>
      )}
    </div>
  );
}
