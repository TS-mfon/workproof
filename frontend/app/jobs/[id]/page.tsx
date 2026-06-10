import { notFound } from "next/navigation";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { JobActionPanel } from "@/components/jobs/JobActionPanel";
import { ApplicantsPanel } from "@/components/jobs/ApplicantsPanel";
import { SubmissionPanel } from "@/components/jobs/SubmissionPanel";
import { SubmissionRankingPanel } from "@/components/jobs/SubmissionRankingPanel";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { StatusTimeline } from "@/components/jobs/StatusTimeline";
import { AddressDisplay } from "@/components/shared/AddressDisplay";
import { EthAmount } from "@/components/shared/EthAmount";
import { Mono } from "@/components/shared/Mono";
import { getActivities, getJob } from "@/lib/data";
import { timeLeft } from "@/lib/format";

// Always render against live chain state — never serve a cached/stale status.
export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, activities] = await Promise.all([getJob(id), getActivities(20, id)]);
  if (!job) notFound();

  return (
    <section className="shell grid gap-6 py-10 lg:grid-cols-[1fr_340px]">
      <div className="grid gap-6">
        <div className="panel p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--accent)" }}>{job.domain}</p>
              <h1 className="mt-2 text-3xl font-black">{job.title}</h1>
            </div>
            <JobStatusBadge status={job.status} />
          </div>
          <div className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-muted">Reward</div>
              <div className="text-lg font-black mt-1"><EthAmount wei={job.reward_amount_wei} /></div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-muted">Deadline</div>
              <div className="text-lg font-black mt-1">{timeLeft(job.deadline)}</div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-muted">Attempt</div>
              <div className="text-lg font-black mt-1">{job.retry_count + 1} of 3</div>
            </div>
          </div>
        </div>

        <div className="panel p-6">
          <h2 className="text-lg font-bold">Project brief</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm" style={{ color: "var(--muted-strong)", lineHeight: 1.7 }}>{job.description}</p>
          <h2 className="mt-6 text-lg font-bold">Acceptance criteria</h2>
          <pre className="mt-3 whitespace-pre-wrap text-sm rounded-lg border p-4 mono" style={{ borderColor: "var(--line)", background: "var(--surface-soft)", color: "var(--muted-strong)", lineHeight: 1.6 }}>{job.acceptance_criteria}</pre>
        </div>

        <div className="panel p-6">
          <h2 className="mb-4 text-lg font-bold">Status timeline</h2>
          <StatusTimeline status={job.status} />
        </div>

        <SubmissionPanel job={job} />
        <SubmissionRankingPanel job={job} />

        <ApplicantsPanel job={job} />

        <div>
          <h2 className="mb-4 text-lg font-bold">Activity</h2>
          <ActivityFeed activities={activities} />
        </div>
      </div>

      <aside className="grid content-start gap-6">
        <div className="panel p-5 grid gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-muted">Client</div>
            <Mono className="mt-1 block"><AddressDisplay address={job.client_wallet} /></Mono>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-muted">Freelancer</div>
            <Mono className="mt-1 block">
              {job.freelancer_wallet || job.assigned_to_wallet
                ? <AddressDisplay address={job.freelancer_wallet || job.assigned_to_wallet} />
                : <span style={{ color: "var(--muted)" }}>— unassigned</span>}
            </Mono>
          </div>
        </div>
        <JobActionPanel job={job} />
      </aside>
    </section>
  );
}
