"use client";

import { useMemo, useState } from "react";
import type { Job } from "@/lib/types";
import { JobCard } from "./JobCard";
import { EmptyState } from "@/components/shared/EmptyState";

const DOMAINS = ["All", "content", "smart-contracts", "frontend", "design", "marketing", "research"];
const STATUSES = ["All", "Open", "Active", "UnderReview", "Passed", "Complete"];
const SORTS = ["Newest", "Highest reward", "Soonest deadline"];

export function JobFilters({ jobs }: { jobs: Job[] }) {
  const [domain, setDomain] = useState("All");
  const [status, setStatus] = useState("All");
  const [sort, setSort] = useState("Newest");

  const filtered = useMemo(() => {
    return jobs
      .filter((j) => j.status !== "Deleted")
      .filter((j) => domain === "All" || j.domain === domain)
      .filter((j) => status === "All" || j.status === status)
      .sort((a, b) => {
        if (sort === "Highest reward") return Number(BigInt(b.reward_amount_wei || "0") - BigInt(a.reward_amount_wei || "0"));
        if (sort === "Soonest deadline") return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [jobs, domain, status, sort]);

  return (
    <div>
      <div className="panel" style={{ padding: 16, marginBottom: 24, display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr" }}>
        <div className="grid gap-1">
          <label>Domain</label>
          <select className="select" value={domain} onChange={(e) => setDomain(e.target.value)}>
            {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="grid gap-1">
          <label>Status</label>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="grid gap-1">
          <label>Sort</label>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No jobs match these filters"
          message="Try a different domain or status — or post the first job in this category."
          ctaLabel="Post a job"
          ctaHref="/jobs/post"
        />
      ) : (
        <div className="grid-auto">
          {filtered.map((job) => <JobCard key={job.job_id_onchain} job={job} />)}
        </div>
      )}
    </div>
  );
}
