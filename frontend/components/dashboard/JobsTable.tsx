import Link from "next/link";
import type { Job } from "@/lib/types";
import { EthAmount } from "@/components/shared/EthAmount";
import { AddressDisplay } from "@/components/shared/AddressDisplay";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { timeLeft } from "@/lib/format";

export function JobsTable({ jobs }: { jobs: Job[] }) {
  if (jobs.length === 0) return <div className="panel p-6 text-slate-600">No jobs in this section.</div>;
  return (
    <div className="panel table-wrap">
      <table>
        <thead><tr><th>Title</th><th>Freelancer</th><th>Status</th><th>Reward</th><th>Deadline</th><th>Action</th></tr></thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.job_id_onchain}>
              <td>{job.title}</td>
              <td><AddressDisplay address={job.freelancer_wallet || job.assigned_to_wallet} /></td>
              <td><JobStatusBadge status={job.status} /></td>
              <td><EthAmount wei={job.reward_amount_wei} /></td>
              <td>{timeLeft(job.deadline)}</td>
              <td><Link className="text-teal-800 font-bold" href={`/jobs/${job.job_id_onchain}`}>Open</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
