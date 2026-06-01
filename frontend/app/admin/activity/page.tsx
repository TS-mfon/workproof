import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { getActivities } from "@/lib/data";

export default async function AdminActivityPage() {
  const activities = await getActivities(200);
  return <section className="shell py-10"><h1 className="mb-6 text-3xl font-black">Admin Activity Log</h1><a className="btn secondary mb-4" href="/api/activity?format=csv">Export CSV</a><ActivityFeed activities={activities} /></section>;
}
