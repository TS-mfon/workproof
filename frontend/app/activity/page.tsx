import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { getActivities } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const activities = await getActivities(20);
  return (
    <section className="shell py-10">
      <p className="live-pill"><span className="live-dot" /> Protocol stream</p>
      <h1 className="mb-6 mt-4 text-4xl font-black text-slate-950">Global Activity</h1>
      <div className="mb-4 flex flex-wrap gap-2 text-sm font-bold">{["All", "Jobs Posted", "Work Submitted", "AI Verdicts", "Payments", "Refunds"].map((tab) => <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700" key={tab}>{tab}</span>)}</div>
      <ActivityFeed activities={activities} />
    </section>
  );
}
