import Link from "next/link";
import { ArrowUpRight, Clock, UserRound } from "lucide-react";
import type { Job } from "@/lib/types";
import { AddressDisplay } from "@/components/shared/AddressDisplay";
import { EthAmount } from "@/components/shared/EthAmount";
import { JobStatusBadge } from "./JobStatusBadge";
import { timeLeft } from "@/lib/format";

export function JobCard({ job }: { job: Job }) {
  return (
    <Link href={`/jobs/${job.job_id_onchain}`} className="panel group block p-5 transition duration-200 hover:-translate-y-1 hover:border-blue-300 hover:shadow-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase text-blue-700">{job.domain}</p>
          <h3 className="mt-1 text-xl font-black text-blue-950">{job.title}</h3>
        </div>
        <JobStatusBadge status={job.status} />
      </div>
      <p className="mt-3 line-clamp-3 text-sm text-slate-600">{job.description}</p>
      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <span className="rounded-md bg-blue-50 px-3 py-2 font-black text-blue-800"><EthAmount wei={job.reward_amount_wei} /></span>
        <span className="flex items-center gap-2 text-slate-600"><Clock size={16} /> {timeLeft(job.deadline)}</span>
        <span className="flex items-center gap-2 text-slate-600"><UserRound size={16} /> <AddressDisplay address={job.client_wallet} /></span>
        <span className="text-slate-600">Assigned: {job.assigned_to_wallet ? <AddressDisplay address={job.assigned_to_wallet} /> : "Open"}</span>
      </div>
      <div className="mt-5 flex items-center gap-2 text-sm font-black text-blue-700 opacity-0 transition group-hover:opacity-100">
        View job <ArrowUpRight size={16} />
      </div>
    </Link>
  );
}
