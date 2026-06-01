import Link from "next/link";

export default function DashboardPage() {
  return (
    <section className="shell py-10">
      <h1 className="mb-6 text-3xl font-black">Dashboard</h1>
      <div className="grid-auto">
        <Link className="panel p-6" href="/dashboard/client"><h2 className="text-2xl font-bold">Client Dashboard</h2><p className="mt-2 text-slate-600">Jobs posted, applications, reviews, payouts, refunds.</p></Link>
        <Link className="panel p-6" href="/dashboard/freelancer"><h2 className="text-2xl font-bold">Freelancer Dashboard</h2><p className="mt-2 text-slate-600">Active work, retries, claims, earnings, reputation.</p></Link>
      </div>
    </section>
  );
}
