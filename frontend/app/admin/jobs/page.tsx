import { AdminActions } from "@/components/admin/AdminActions";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { AddressDisplay } from "@/components/shared/AddressDisplay";
import { EthAmount } from "@/components/shared/EthAmount";
import { getJobs } from "@/lib/data";

export default async function AdminJobsPage() {
  const jobs = await getJobs(1000);
  return <section className="shell py-10"><h1 className="mb-6 text-3xl font-black">Jobs Management</h1><div className="panel table-wrap"><table><thead><tr><th>Title</th><th>Status</th><th>Client</th><th>Freelancer</th><th>Reward</th><th>Actions</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.job_id_onchain}><td>{job.title}</td><td><JobStatusBadge status={job.status} /></td><td><AddressDisplay address={job.client_wallet} /></td><td><AddressDisplay address={job.freelancer_wallet || job.assigned_to_wallet} /></td><td><EthAmount wei={job.reward_amount_wei} /></td><td><AdminActions jobId={job.job_id_onchain} /></td></tr>)}</tbody></table></div></section>;
}
