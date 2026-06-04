import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { getActivities } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const activities = await getActivities(50);
  return (
    <section className="shell py-12">
      <div style={{ marginBottom: 32 }}>
        <p className="text-xs font-bold uppercase tracking-widest text-accent-strong">Protocol stream</p>
        <h1 style={{ fontSize: 36, fontWeight: 800, marginTop: 8 }}>Activity</h1>
        <p className="text-sm text-muted" style={{ marginTop: 6 }}>
          Every state change in the WorkProof contract, in order. Each entry links to the on-chain transaction.
        </p>
      </div>
      <ActivityFeed activities={activities} />
    </section>
  );
}
