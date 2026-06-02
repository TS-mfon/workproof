import Link from "next/link";
import { CheckCircle2, Plus } from "lucide-react";
import { JobFilters } from "@/components/jobs/JobFilters";
import { EthAmount } from "@/components/shared/EthAmount";
import { getJobs } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const jobs = await getJobs();
  const featured = jobs[0];
  return (
    <section className="shell py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="live-pill">
            <span className="live-dot" /> Live network
          </p>
          <h1 className="mt-4 text-4xl font-black text-slate-950 md:text-6xl">Jobs Marketplace</h1>
          <p className="mt-3 max-w-2xl text-slate-600">Browse real escrow-backed work streamed from Supabase and the deployed WorkProof contract.</p>
        </div>
        <Link className="btn" href="/jobs/post"><Plus size={16} /> Post a Job</Link>
      </div>
      {featured && (
        <Link href={`/jobs/${featured.job_id_onchain}`} className="featured-job mb-8 block">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase text-blue-600">Featured Job</p>
              <h2 className="mt-3 text-3xl font-black text-slate-950">{featured.title}</h2>
              <p className="mt-3 max-w-2xl text-slate-600">{featured.description}</p>
            </div>
            <CheckCircle2 className="text-blue-600" />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-4xl font-black text-blue-600"><EthAmount wei={featured.reward_amount_wei} /></p>
            <span className="btn">Claim Task</span>
          </div>
        </Link>
      )}
      <JobFilters jobs={jobs} />
    </section>
  );
}
