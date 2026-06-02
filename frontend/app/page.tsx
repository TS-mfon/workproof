import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, FileCheck2, LockKeyhole, Network, ShieldCheck, Sparkles, Wallet, Zap } from "lucide-react";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { JobCard } from "@/components/jobs/JobCard";
import { LeaderboardRow } from "@/components/leaderboard/LeaderboardRow";
import { EthAmount } from "@/components/shared/EthAmount";
import { getActivities, getJobs, getStats, getUsers } from "@/lib/data";

const steps = [
  ["Post Job", "Client writes acceptance criteria and locks ETH on Arbitrum Sepolia."],
  ["Accept Job", "Open work is claimed or directly assigned to a wallet."],
  ["Submit Work", "Freelancer submits a public deliverable URL before deadline."],
  ["AI Verifies", "GenLayer validators inspect the work against the criteria."],
  ["Auto Pay", "Passing work becomes claimable without client approval."]
];

export default async function HomePage() {
  const [stats, jobs, users, activities] = await Promise.all([getStats(), getJobs(6), getUsers(5), getActivities(10)]);
  return (
    <>
      <section className="hero-stage overflow-hidden">
        <div className="shell hero-grid py-16 lg:py-20">
          <div className="animate-rise max-w-3xl">
            <p className="eyebrow">
              <Sparkles size={15} /> Welcome to an Autonomous Freelancing Protocol.
            </p>
            <h1 className="mt-6 text-5xl font-black leading-[1.02] text-blue-950 md:text-7xl">
              Work is verified before escrow moves.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Post jobs with measurable acceptance criteria, lock ETH on Arbitrum Sepolia, and let GenLayer validator consensus decide whether submitted work deserves payment.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="btn" href="/jobs">Browse Jobs <ArrowRight size={18} /></Link>
              <Link className="btn secondary" href="/jobs/post">Post a Job</Link>
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <div className="trust-chip"><LockKeyhole size={17} /> ETH locked first</div>
              <div className="trust-chip"><Bot size={17} /> GenLayer reviewed</div>
              <div className="trust-chip"><ShieldCheck size={17} /> No manual release</div>
            </div>
          </div>

          <div className="protocol-visual">
            <div className="visual-topbar">
              <span className="logo-mark">W</span>
              <div>
                <p className="text-sm font-black text-blue-950">WorkProof Escrow</p>
                <p className="text-xs font-bold text-slate-500">Arbitrum Sepolia + GenLayer</p>
              </div>
              <span className="ml-auto rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Live</span>
            </div>
            <div className="mt-6 grid gap-4">
              {[
                ["01", "Client funds escrow", "Acceptance criteria and ETH are committed onchain.", Wallet],
                ["02", "Freelancer submits URL", "A public deliverable is attached to the active job.", FileCheck2],
                ["03", "Validators decide", "GenLayer checks the work and exposes a verdict.", Network],
                ["04", "Reward is claimable", "Approved work becomes payable to the freelancer.", CheckCircle2]
              ].map(([num, title, copy, Icon]) => (
                <div className="process-row" key={String(title)}>
                  <span>{num as string}</span>
                  <Icon className="text-blue-600" size={20} />
                  <div>
                    <p className="font-black text-blue-950">{title as string}</p>
                    <p className="text-sm leading-6 text-slate-600">{copy as string}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black uppercase text-blue-700">Autonomous status</p>
                <p className="text-sm font-black text-blue-950">Under AI review</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full w-3/4 rounded-full bg-blue-600" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="shell stats-strip">
        <div className="metric-card"><p>Total Jobs Posted</p><b>{stats.totalJobs}</b></div>
        <div className="metric-card"><p>Total ETH Escrowed</p><b><EthAmount wei={stats.totalEscrowed} /></b></div>
        <div className="metric-card"><p>Jobs Completed</p><b>{stats.completed}</b></div>
        <div className="metric-card"><p>Active Freelancers</p><b>{stats.activeFreelancers}</b></div>
      </section>

      <section className="section-band">
        <div className="shell py-14">
          <div className="section-heading">
            <p>How it works</p>
            <h2>Five steps, no manual payment release.</h2>
            <span>Every state is either read from Supabase metadata or the deployed escrow contract.</span>
          </div>
          <div className="mt-8 grid-auto">
            {steps.map(([step, copy], index) => (
              <div className="step-card" key={step}>
                <div className="step-number">{index + 1}</div>
                <h3>{step}</h3>
                <p>{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="shell py-14">
        <div className="section-heading row">
          <div>
            <p>Live market</p>
            <h2>Featured jobs</h2>
            <span>Only live records are shown. No fake production cards.</span>
          </div>
          <Link className="btn secondary" href="/jobs">View all jobs</Link>
        </div>
        {jobs.length ? <div className="mt-8 grid-auto">{jobs.map((job) => <JobCard key={job.job_id_onchain} job={job} />)}</div> : <div className="empty-state mt-8">No open jobs yet. Post the first job to create the first marketplace record.</div>}
      </section>

      <section className="shell grid gap-8 py-10 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <div className="section-heading compact">
            <p>Leaderboard</p>
            <h2>Reputation leaders</h2>
          </div>
          <div className="panel table-wrap mt-5 overflow-hidden"><table><tbody>{users.map((user, i) => <LeaderboardRow key={user.wallet_address} user={user} rank={i + 1} />)}</tbody></table></div>
        </div>
        <div>
          <div className="section-heading compact">
            <p>Activity</p>
            <h2>Recent protocol events</h2>
          </div>
          <div className="mt-5"><ActivityFeed activities={activities} /></div>
        </div>
      </section>

      <section className="shell py-14">
        <div className="section-heading">
          <p>Why WorkProof</p>
          <h2>Escrow UX built for clear outcomes.</h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="feature-card"><LockKeyhole /><h3>Escrow first</h3><p>Every job starts with real ETH locked in the deployed contract.</p></div>
          <div className="feature-card"><Bot /><h3>GenLayer review</h3><p>Validators compare the submitted deliverable to signed criteria.</p></div>
          <div className="feature-card"><CheckCircle2 /><h3>Claimable rewards</h3><p>Approved work becomes payable without client discretion.</p></div>
        </div>
        <div className="cta-band mt-8">
          <div><p>Ready to put work onchain?</p><span>Post a job with measurable acceptance criteria and autonomous review.</span></div>
          <Link className="btn" href="/jobs/post"><Zap size={16} /> Start jobbing</Link>
        </div>
      </section>
    </>
  );
}
