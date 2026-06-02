import type { JobStatus } from "@/lib/types";

const styles: Record<JobStatus, string> = {
  Open: "border-cyan-300/50 bg-cyan-300/10 text-cyan-300",
  Active: "border-blue-300/50 bg-blue-300/10 text-blue-200",
  UnderReview: "border-amber-300/50 bg-amber-300/10 text-amber-200",
  Failed: "border-red-300/50 bg-red-300/10 text-red-200",
  Passed: "border-emerald-300/50 bg-emerald-300/10 text-emerald-200",
  Complete: "border-slate-300/40 bg-slate-300/10 text-slate-200",
  Refunded: "border-zinc-300/40 bg-zinc-300/10 text-zinc-200"
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <span className={`inline-flex rounded-[4px] border px-2 py-1 text-xs font-black uppercase tracking-[0.12em] ${styles[status]}`}>{status}</span>;
}
