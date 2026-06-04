"use client";

import { useAccount } from "wagmi";
import { AddressDisplay } from "@/components/shared/AddressDisplay";
import { Mono } from "@/components/shared/Mono";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { Job } from "@/lib/types";

export function SubmissionPanel({ job }: { job: Job }) {
  const { address } = useAccount();
  const wallet = address?.toLowerCase();
  const isClient = wallet === job.client_wallet.toLowerCase();
  const isFreelancer = wallet === (job.freelancer_wallet || job.assigned_to_wallet || "").toLowerCase();

  const visibleStatuses = new Set(["UnderReview", "Failed", "Passed", "Complete"]);
  if (!visibleStatuses.has(job.status)) return null;
  if (!isClient && !isFreelancer) return null;
  if (!job.deliverable_url) return null;

  const isSafeUrl = (() => {
    try {
      const u = new URL(job.deliverable_url);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  })();

  const verdict = job.ai_verdict as Record<string, unknown> | null;
  const summary = verdict?.summary ? String(verdict.summary) : null;
  const issues = verdict?.issues ? String(verdict.issues) : null;
  const qualityScore = verdict?.quality_score ?? verdict?.qualityScore;

  return (
    <div className="panel p-6 grid gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold">Submission</h2>
          <p className="text-xs text-muted mt-1">
            Delivered by <Mono><AddressDisplay address={job.freelancer_wallet || job.assigned_to_wallet} /></Mono> · attempt {job.retry_count + 1} of 3
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="rounded-lg border" style={{ borderColor: "var(--line)", background: "var(--surface-soft)", padding: 14 }}>
        <div className="text-xs uppercase tracking-wide font-bold" style={{ color: "var(--muted)" }}>Deliverable</div>
        {isSafeUrl ? (
          <a
            href={job.deliverable_url}
            target="_blank"
            rel="noreferrer noopener"
            className="mono text-sm break-all"
            style={{ color: "var(--accent-strong)", marginTop: 6, display: "block" }}
          >
            {job.deliverable_url}
          </a>
        ) : (
          <div style={{ marginTop: 6 }}>
            <span className="mono text-sm break-all" style={{ color: "var(--muted-strong)" }}>{job.deliverable_url}</span>
            <p className="text-xs mt-2" style={{ color: "var(--warn)" }}>
              ⚠ This deliverable URL uses an unsupported protocol. It's not safe to open from the app — review it manually first.
            </p>
          </div>
        )}
      </div>

      {job.status === "UnderReview" && (
        <div className="rounded-lg border" style={{ borderColor: "var(--warn-soft)", background: "var(--warn-soft)", padding: 14 }}>
          <div className="flex items-center gap-2">
            <span className="status-badge" data-state="under-review"><span className="dot" /> Verifying with GenLayer</span>
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--muted-strong)" }}>
            The decentralized AI verifier is reading the deliverable against your acceptance criteria. This usually takes 1–3 minutes.
          </p>
        </div>
      )}

      {(job.status === "Passed" || job.status === "Failed" || job.status === "Complete") && verdict && (
        <div className="grid gap-3">
          {typeof qualityScore !== "undefined" && (
            <div className="flex gap-3 text-sm">
              <span className="text-muted">Quality score</span>
              <strong>{String(qualityScore)}/100</strong>
            </div>
          )}
          {summary && (
            <div>
              <div className="text-xs uppercase tracking-wide font-bold" style={{ color: "var(--muted)" }}>AI summary</div>
              <p className="text-sm mt-1">{summary}</p>
            </div>
          )}
          {issues && (
            <div>
              <div className="text-xs uppercase tracking-wide font-bold" style={{ color: "var(--muted)" }}>Issues raised</div>
              <p className="text-sm mt-1" style={{ color: "var(--warn)" }}>{issues}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
