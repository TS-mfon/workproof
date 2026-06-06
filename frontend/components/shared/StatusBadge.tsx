import type { JobStatus } from "@/lib/types";

const stateMap: Record<string, string> = {
  Open: "open",
  Active: "active",
  UnderReview: "under-review",
  Failed: "failed",
  AwaitingApproval: "under-review",
  Passed: "passed",
  Complete: "complete",
  Refunded: "refunded",
  Deleted: "deleted"
};

const labelMap: Record<string, string> = {
  Open: "Open",
  Active: "In Progress",
  UnderReview: "AI Review",
  Failed: "Failed",
  AwaitingApproval: "Client Approval",
  Passed: "Passed",
  Complete: "Complete",
  Refunded: "Refunded",
  Deleted: "Deleted"
};

export function StatusBadge({ status }: { status: JobStatus | string }) {
  const state = stateMap[status] ?? "open";
  const label = labelMap[status] ?? status;
  return (
    <span className="status-badge" data-state={state}>
      <span className="dot" /> {label}
    </span>
  );
}
