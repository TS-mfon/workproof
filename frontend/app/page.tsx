import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, FileCheck2, LockKeyhole, ShieldCheck, Zap } from "lucide-react";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { JobCard } from "@/components/jobs/JobCard";
import { LeaderboardRow } from "@/components/leaderboard/LeaderboardRow";
import { EthAmount } from "@/components/shared/EthAmount";
import { getActivities, getJobs, getStats, getUsers } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [stats, jobs, users, activities] = await Promise.all([getStats(), getJobs(6), getUsers(5), getActivities(8)]);
  const featured = jobs[0];

  return (
    <>
      <section className="hero-stage">
        <div className="shell hero-grid">
          <div className="animate-rise max-w-3xl">
            <p className="eyebrow"><span className="live-dot" /> Live autonomous escrow</p>
            <h1 className="mt-6 text-5xl font-black leading-[1.02] text-slate-950 md:text-7xl">
              Work verified before payment.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              A trust-first escrow marketplace where clients lock funds, freelancers submit clear deliverables, and GenLayer verifies completion against written criteria.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="btn" href="/jobs">Browse Jobs <ArrowRight size={18} /></Link>
              <Link className="btn secondary" href="/jobs/post">Post a Job</Link>
            </div>
          </div>

          <div className="protocol-visual">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase text-blue-600">Escrow flow</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">From task to claim</h2>
              </div>
              <span className="live-pill"><span className="live-dot" /> Live</span>
            </div>
            <div className="mt-8 grid gap-3">
              {[
                ["Escrow", "ETH locked on Arbitrum", LockKeyhole],
                ["Submit", "Deliverable URL attached", FileCheck2],
                ["Verify", "GenLayer consensus review", Bot],
                ["Claim", "Approved reward released", ShieldCheck]
              ].map(([label, copy, Icon]) => (
                <div className="process-row" key={String(label)}>
                  <span><Icon size={18} /></span>
                  <div>
                    <p className="font-black text-slate-950">{label as string}</p>
                    <p className="text-sm text-slate-600">{copy as string}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="shell stats-strip">
        <div className="metric-card"><p>Total Jobs</p><b>{stats.totalJobs}</b></div>
        <div className="metric-card"><p>ETH Escrowed</p><b><EthAmount wei={stats.totalEscrowed} /></b></div>
        <div className="metric-card"><p>Completed</p><b>{stats.completed}</b></div>
        <div className="metric-card"><p>Freelancers</p><b>{stats.activeFreelancers}</b></div>
      </section>

      <section className="shell py-10">
        <div className="section-heading row">
          <div>
            <p>Jobs marketplace</p>
            <h2>Live work feed</h2>
            <span>Real stress-test jobs from the deployed escrow contract and synced protocol data.</span>
          </div>
          <Link className="btn secondary" href="/jobs">View all</Link>
        </div>
        {featured ? (
          <div className="mt-8 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="featured-job">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase text-blue-600">Featured job</p>
                  <h3 className="mt-4 text-3xl font-black text-slate-950">{featured.title}</h3>
                </div>
                <CheckCircle2 className="text-blue-600" />
              </div>
              <p className="mt-5 line-clamp-3 text-slate-600">{featured.description}</p>
              <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                <p className="text-3xl font-black text-blue-600"><EthAmount wei={featured.reward_amount_wei} /></p>
                <Link className="btn" href={`/jobs/${featured.job_id_onchain}`}>Claim Task <Zap size={16} /></Link>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {jobs.slice(1, 5).map((job) => <JobCard key={job.job_id_onchain} job={job} />)}
            </div>
          </div>
        ) : (
          <div className="empty-state mt-8">No onchain jobs are visible yet.</div>
        )}
      </section>

      <section className="shell grid gap-8 py-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <div className="section-heading compact">
            <p>Reputation</p>
            <h2>Leaderboard</h2>
          </div>
          <div className="panel table-wrap mt-5 overflow-hidden">
            <table><tbody>{users.map((user, i) => <LeaderboardRow key={user.wallet_address} user={user} rank={i + 1} />)}</tbody></table>
          </div>
        </div>
        <div>
          <div className="section-heading compact">
            <p>Activity</p>
            <h2>Protocol stream</h2>
          </div>
          <div className="mt-5"><ActivityFeed activities={activities} /></div>
        </div>
      </section>
    </>
  );
}
