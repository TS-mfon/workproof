import { notFound } from "next/navigation";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { JobActionPanel } from "@/components/jobs/JobActionPanel";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { StatusTimeline } from "@/components/jobs/StatusTimeline";
import { AddressDisplay } from "@/components/shared/AddressDisplay";
import { EthAmount } from "@/components/shared/EthAmount";
import { getActivities, getJob } from "@/lib/data";
import { timeLeft } from "@/lib/format";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, activities] = await Promise.all([getJob(id), getActivities(20, id)]);
  if (!job) notFound();
  const verdict = job.ai_verdict;
  return (
    <section className="shell grid gap-6 py-10 lg:grid-cols-[1fr_340px]">
      <div className="grid gap-6">
        <div className="panel p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="font-black uppercase tracking-[0.16em] text-cyan-300">{job.domain}</p><h1 className="mt-2 text-3xl font-black uppercase tracking-[0.08em] text-white">{job.title}</h1></div>
            <JobStatusBadge status={job.status} />
          </div>
          <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-3"><p><b className="text-cyan-300">Reward:</b> <EthAmount wei={job.reward_amount_wei} /></p><p><b className="text-cyan-300">Deadline:</b> {timeLeft(job.deadline)}</p><p><b className="text-cyan-300">Retry:</b> Attempt {job.retry_count + 1} of 3</p></div>
        </div>
        <div className="panel p-6"><h2 className="text-xl font-black uppercase tracking-[0.08em] text-white">Description</h2><p className="mt-3 whitespace-pre-wrap text-slate-400">{job.description}</p><h2 className="mt-6 text-xl font-black uppercase tracking-[0.08em] text-white">Acceptance Criteria</h2><p className="mt-3 whitespace-pre-wrap text-slate-400">{job.acceptance_criteria}</p></div>
        <div className="panel p-6"><h2 className="mb-4 text-xl font-black uppercase tracking-[0.08em] text-white">Status Timeline</h2><StatusTimeline status={job.status} /></div>
        {(job.status === "UnderReview" || job.status === "Passed" || job.status === "Failed") && <div className="panel p-6"><h2 className="text-xl font-black uppercase tracking-[0.08em] text-white">AI Verdict</h2>{verdict ? <pre className="mt-3 overflow-auto rounded-[4px] border border-cyan-300/10 bg-black/20 p-4 text-sm text-slate-300">{JSON.stringify(verdict, null, 2)}</pre> : <p className="mt-3 text-slate-400">AI reviewing...</p>}</div>}
        <div><h2 className="mb-4 text-xl font-black uppercase tracking-[0.08em] text-white">Activity History</h2><ActivityFeed activities={activities} /></div>
      </div>
      <aside className="grid content-start gap-6">
        <div className="panel p-5"><h2 className="text-xl font-black uppercase tracking-[0.08em] text-white">Client</h2><p className="mt-2 text-cyan-300"><AddressDisplay address={job.client_wallet} /></p><h2 className="mt-5 text-xl font-black uppercase tracking-[0.08em] text-white">Freelancer</h2><p className="mt-2 text-cyan-300"><AddressDisplay address={job.freelancer_wallet || job.assigned_to_wallet} /></p></div>
        <JobActionPanel job={job} />
      </aside>
    </section>
  );
}
