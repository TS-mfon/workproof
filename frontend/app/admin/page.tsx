import Link from "next/link";
import { getJobs } from "@/lib/data";
import { eth } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const jobs = await getJobs(1000);
  return (
    <section className="shell grid gap-8 py-10">
      <h1 className="text-3xl font-black text-slate-950">Admin Dashboard</h1>
      <div className="grid-auto">
        <div className="panel p-5"><p>Total jobs</p><b className="text-2xl">{jobs.length}</b></div>
        <div className="panel p-5"><p>Total ETH locked</p><b className="text-2xl">{eth(jobs.reduce((sum, job) => sum + BigInt(job.escrow_amount_wei || "0"), 0n))}</b></div>
        <div className="panel p-5"><p>Total ETH paid out</p><b className="text-2xl">{eth(jobs.filter((job) => job.status === "Complete").reduce((sum, job) => sum + BigInt(job.reward_amount_wei || "0"), 0n))}</b></div>
        <div className="panel p-5"><p>Total ETH refunded</p><b className="text-2xl">{jobs.filter((job) => job.status === "Refunded").length}</b></div>
      </div>
      <div className="grid-auto">
        {["jobs", "users", "oracle", "activity", "actions"].map((page) => <Link className="panel p-6 text-xl font-bold capitalize text-blue-700" key={page} href={`/admin/${page}`}>{page}</Link>)}
      </div>
    </section>
  );
}
