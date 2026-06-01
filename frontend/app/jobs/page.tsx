import Link from "next/link";
import { BriefcaseBusiness, Plus } from "lucide-react";
import { JobFilters } from "@/components/jobs/JobFilters";
import { getJobs } from "@/lib/data";

export default async function JobsPage() {
  const jobs = await getJobs();
  return (
    <section className="shell py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-black uppercase text-blue-700">
            <BriefcaseBusiness size={15} /> Live work market
          </p>
          <h1 className="mt-4 text-4xl font-black text-blue-950">Job Board</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Browse real escrow-backed work. Every card is sourced from Supabase and onchain job state.</p>
        </div>
        <Link className="btn" href="/jobs/post"><Plus size={16} /> Post a Job</Link>
      </div>
      <JobFilters jobs={jobs} />
    </section>
  );
}
