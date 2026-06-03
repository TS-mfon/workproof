import Link from "next/link";
import { AdminActions } from "@/components/admin/AdminActions";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { AddressDisplay } from "@/components/shared/AddressDisplay";
import { EthAmount } from "@/components/shared/EthAmount";
import { Mono } from "@/components/shared/Mono";
import { getJobs } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminJobsPage() {
  const jobs = await getJobs(2000);
  return (
    <div className="panel table-wrap">
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Client</th>
            <th>Freelancer</th>
            <th>Reward</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.job_id_onchain}>
              <td><Link href={`/jobs/${job.job_id_onchain}`} style={{ color: "var(--foreground)", fontWeight: 700 }}>{job.title}</Link></td>
              <td><JobStatusBadge status={job.status} /></td>
              <td><Mono><AddressDisplay address={job.client_wallet} /></Mono></td>
              <td><Mono>{job.freelancer_wallet || job.assigned_to_wallet ? <AddressDisplay address={job.freelancer_wallet || job.assigned_to_wallet} /> : <span style={{ color: "var(--muted)" }}>—</span>}</Mono></td>
              <td><EthAmount wei={job.reward_amount_wei} /></td>
              <td><AdminActions jobId={job.job_id_onchain} status={job.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
