import { StatusBadge } from "@/components/shared/StatusBadge";
import type { JobStatus } from "@/lib/types";

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <StatusBadge status={status} />;
}
