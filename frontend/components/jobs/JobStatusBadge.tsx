import type { JobStatus } from "@/lib/types";

const styles: Record<JobStatus, string> = {
  Open: "border-blue-200 bg-blue-50 text-blue-700",
  Active: "border-indigo-200 bg-indigo-50 text-indigo-700",
  UnderReview: "border-amber-200 bg-amber-50 text-amber-700",
  Failed: "border-red-200 bg-red-50 text-red-700",
  Passed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Complete: "border-slate-200 bg-slate-50 text-slate-700",
  Refunded: "border-zinc-200 bg-zinc-50 text-zinc-700"
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${styles[status]}`}>{status}</span>;
}
