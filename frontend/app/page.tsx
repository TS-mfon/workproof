import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, Clock3, LockKeyhole, Sparkles, Zap } from "lucide-react";
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
      <section className="glass-band overflow-hidden">
        <div className="shell grid min-h-[650px] items-center gap-10 py-14 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="animate-rise">
            <p className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 text-sm font-black uppercase text-blue-700">
              <Sparkles size={15} /> Welcome to an Autonomous Freelancing Protocol.
            </p>
            <h1 className="mt-6 max-w-5xl text-5xl font-black leading-[1.03] tracking-normal text-blue-950 md:text-7xl">
              Hire and get hired. AI decides who gets paid.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Clients lock ETH, freelancers ship work, and GenLayer validator consensus checks the deliverable against signed acceptance criteria before escrow resolves.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="btn" href="/jobs">Browse Jobs <ArrowRight size={18} /></Link>
              <Link className="btn secondary" href="/jobs/post">Post a Job</Link>
            </div>
          </div>
          <div className="animate-float panel elevated p-5">
            <div className="rounded-lg bg-blue-950 p-5 text-white">
              <div className="flex items-center justify-between">
                <span className="logo-mark">W</span>
                <span className="rounded-full bg-sky-400/20 px-3 py-1 text-xs font-bold text-sky-100">Arbitrum Sepolia</span>
              </div>
              <h2 className="mt-8 text-3xl font-black">Autonomous escrow state</h2>
              <div className="mt-6 grid gap-3">
                {[
                  ["Escrow locked", "Client funds secured onchain"],
                  ["Work submitted", "Oracle triggers GenLayer review"],
                  ["Verdict ready", "Reward claimable or retry required"]
                ].map(([title, copy]) => (
                  <div className="rounded-md border border-white/10 bg-white/10 p-4" key={title}>
                    <p className="font-bold">{title}</p>
                    <p className="mt-1 text-sm text-blue-100">{copy}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="shell -mt-10 grid gap-4 pb-12 md:grid-cols-4">
        <div className="metric-card"><p>Total Jobs Posted</p><b className="text-3xl text-blue-950">{stats.totalJobs}</b></div>
        <div className="metric-card"><p>Total ETH Escrowed</p><b className="text-3xl text-blue-950"><EthAmount wei={stats.totalEscrowed} /></b></div>
        <div className="metric-card"><p>Jobs Completed</p><b className="text-3xl text-blue-950">{stats.completed}</b></div>
        <div className="metric-card"><p>Active Freelancers</p><b className="text-3xl text-blue-950">{stats.activeFreelancers}</b></div>
      </section>

      <section className="shell py-12">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase text-blue-600">How it works</p>
            <h2 className="mt-2 text-3xl font-black text-blue-950">Five steps, no manual release.</h2>
          </div>
        </div>
        <div className="grid-auto">
          {steps.map(([step, copy], index) => (
            <div className="panel p-5 transition hover:-translate-y-1 hover:border-blue-300" key={step}>
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-blue-600 text-lg font-black text-white">{index + 1}</div>
              <h3 className="mt-5 text-xl font-black text-blue-950">{step}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="shell py-10">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black uppercase text-blue-600">Live market</p>
            <h2 className="text-3xl font-black text-blue-950">Featured Jobs</h2>
          </div>
          <Link className="btn secondary" href="/jobs">View all jobs</Link>
        </div>
        {jobs.length ? <div className="grid-auto">{jobs.map((job) => <JobCard key={job.job_id_onchain} job={job} />)}</div> : <div className="panel p-8">No open jobs yet.</div>}
      </section>

      <section className="shell grid gap-8 py-10 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 text-3xl font-black text-blue-950">Reputation Leaders</h2>
          <div className="panel table-wrap overflow-hidden"><table><tbody>{users.map((user, i) => <LeaderboardRow key={user.wallet_address} user={user} rank={i + 1} />)}</tbody></table></div>
        </div>
        <div>
          <h2 className="mb-4 text-3xl font-black text-blue-950">Recent Activity</h2>
          <ActivityFeed activities={activities} />
        </div>
      </section>

      <section className="shell py-14">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="panel p-6"><LockKeyhole className="text-blue-600" /><h3 className="mt-4 text-xl font-black">Escrow first</h3><p className="mt-2 text-slate-600">Every job starts with real ETH locked in the contract.</p></div>
          <div className="panel p-6"><Bot className="text-blue-600" /><h3 className="mt-4 text-xl font-black">GenLayer review</h3><p className="mt-2 text-slate-600">Validators compare the submitted deliverable to client criteria.</p></div>
          <div className="panel p-6"><CheckCircle2 className="text-blue-600" /><h3 className="mt-4 text-xl font-black">Claimable rewards</h3><p className="mt-2 text-slate-600">Approved work becomes claimable without client discretion.</p></div>
        </div>
        <div className="mt-6 panel flex flex-wrap items-center justify-between gap-4 bg-blue-950 p-6 text-white">
          <div><p className="font-black">Ready to put work onchain?</p><p className="text-blue-100">Post a job with measurable acceptance criteria.</p></div>
          <Link className="btn" href="/jobs/post"><Zap size={16} /> Start jobbing</Link>
        </div>
      </section>
    </>
  );
}
