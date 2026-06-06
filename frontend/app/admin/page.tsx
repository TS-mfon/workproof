import { getJobs, getUsers } from "@/lib/data";
import { eth } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [jobs, users] = await Promise.all([getJobs(2000), getUsers(2000)]);
  const byStatus: Record<string, number> = {};
  for (const j of jobs) byStatus[j.status] = (byStatus[j.status] ?? 0) + 1;
  const locked = jobs.filter((j) => !["Complete", "Refunded", "Deleted"].includes(j.status))
    .reduce((sum, j) => sum + BigInt(j.escrow_amount_wei || "0"), 0n);
  const paid = jobs.filter((j) => j.status === "Complete")
    .reduce((sum, j) => sum + BigInt(j.reward_amount_wei || "0"), 0n);
  const banned = users.filter((u) => u.banned).length;

  const metrics = [
    { label: "Total jobs", value: jobs.length.toString() },
    { label: "Locked escrow", value: eth(locked) },
    { label: "Paid out", value: eth(paid) },
    { label: "Banned wallets", value: banned.toString() }
  ];

  const statusOrder = ["Open", "Active", "UnderReview", "Failed", "AwaitingApproval", "Passed", "Complete", "Refunded", "Deleted"];

  return (
    <div className="grid gap-6">
      <div className="grid-auto">
        {metrics.map((m) => (
          <div className="metric-card" key={m.label}>
            <p>{m.label}</p>
            <b>{m.value}</b>
          </div>
        ))}
      </div>

      <div className="panel p-6">
        <h2 className="text-lg font-bold mb-4">Jobs by status</h2>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
          {statusOrder.map((s) => (
            <div key={s} style={{ background: "var(--surface-soft)", border: "1px solid var(--line)", borderRadius: 10, padding: 14 }}>
              <div className="text-xs uppercase tracking-wide font-bold" style={{ color: "var(--muted)" }}>{s}</div>
              <div className="text-2xl font-black mt-1">{byStatus[s] ?? 0}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
