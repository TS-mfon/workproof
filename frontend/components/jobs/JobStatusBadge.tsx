import type { JobStatus } from "@/lib/types";

const styles: Record<JobStatus, string> = {
  Open: "border-teal-700 text-teal-800",
  Active: "border-blue-700 text-blue-800",
  UnderReview: "border-amber-700 text-amber-800",
  Failed: "border-red-700 text-red-800",
  Passed: "border-emerald-700 text-emerald-800",
  Complete: "border-slate-700 text-slate-800",
  Refunded: "border-zinc-700 text-zinc-800"
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-bold ${styles[status]}`}>{status}</span>;
}
