import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { getActivities } from "@/lib/data";

export default async function ActivityPage() {
  const activities = await getActivities(20);
  return (
    <section className="shell py-10">
      <h1 className="mb-6 text-3xl font-black">Global Activity</h1>
      <div className="mb-4 flex flex-wrap gap-2 text-sm font-bold">{["All", "Jobs Posted", "Work Submitted", "AI Verdicts", "Payments", "Refunds"].map((tab) => <span className="rounded-md border px-3 py-2" key={tab}>{tab}</span>)}</div>
      <ActivityFeed activities={activities} />
    </section>
  );
}
