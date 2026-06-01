import type { JobStatus } from "@/lib/types";

const steps: JobStatus[] = ["Open", "Active", "UnderReview", "Passed", "Complete"];

export function StatusTimeline({ status }: { status: JobStatus }) {
  const active = steps.indexOf(status);
  return (
    <div className="grid gap-2 sm:grid-cols-5">
      {steps.map((step, index) => (
        <div key={step} className={`rounded-md border p-3 text-sm font-bold ${index <= active ? "border-teal-700 bg-teal-50 text-teal-900" : "border-slate-200 text-slate-500"}`}>
          {step}
        </div>
      ))}
      {(status === "Failed" || status === "Refunded") && <div className="rounded-md border border-red-700 bg-red-50 p-3 text-sm font-bold text-red-900">{status}</div>}
    </div>
  );
}
