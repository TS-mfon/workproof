import Link from "next/link";
import type { Job } from "@/lib/types";
import { JobStatusBadge } from "./JobStatusBadge";
import { AddressDisplay } from "@/components/shared/AddressDisplay";
import { eth } from "@/lib/format";

export function JobCard({ job }: { job: Job }) {
  const ms = new Date(job.deadline).getTime() - Date.now();
  const expired = ms <= 0;
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const timeLabel = expired
    ? "Expired"
    : days > 0
      ? `${days}d ${hours}h left`
      : hours > 0
        ? `${hours}h ${minutes}m left`
        : `${minutes}m left`;
  const urgent = !expired && days === 0 && hours < 6;

  return (
    <Link href={`/jobs/${job.job_id_onchain}`} className="job-card" style={{ textDecoration: "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <span className="text-xs uppercase tracking-wider font-bold text-accent-strong">{job.domain}</span>
            <JobStatusBadge status={job.status} />
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--foreground)", lineHeight: 1.3 }}>{job.title}</h3>
        </div>
      </div>

      <p style={{ fontSize: 13, color: "var(--muted-strong)", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {job.description}
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span className="reward-chip">{eth(job.reward_amount_wei)}</span>
        <span className={`time-badge ${urgent ? "urgent" : ""}`}>⏱ {timeLabel}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid var(--line)" }}>
        <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
          <AddressDisplay address={job.client_wallet} />
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-strong)" }}>
          View →
        </span>
      </div>
    </Link>
  );
}
