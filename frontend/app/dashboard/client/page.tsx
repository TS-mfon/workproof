import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { JobsTable } from "@/components/dashboard/JobsTable";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { EthAmount } from "@/components/shared/EthAmount";
import { getActivities, getJobs } from "@/lib/data";
import { eth } from "@/lib/format";

export default async function ClientDashboardPage() {
  const [jobs, activities] = await Promise.all([getJobs(1000), getActivities(20)]);
  const escrowed = jobs.reduce((sum, job) => sum + BigInt(job.escrow_amount_wei || "0"), 0n);
  const completed = jobs.filter((job) => job.status === "Complete");
  const refunded = jobs.filter((job) => job.status === "Refunded");
  const stats = [
    { label: "Total Jobs Posted", value: jobs.length },
    { label: "Open Jobs", value: jobs.filter((job) => job.status === "Open").length },
    { label: "Active Jobs", value: jobs.filter((job) => job.status === "Active").length },
    { label: "Jobs Under AI Review", value: jobs.filter((job) => job.status === "UnderReview").length },
    { label: "Jobs Completed", value: completed.length },
    { label: "Total ETH Escrowed", value: eth(escrowed) },
    { label: "Total ETH Paid Out", value: eth(completed.reduce((sum, job) => sum + BigInt(job.reward_amount_wei || "0"), 0n)) },
    { label: "Total ETH Refunded", value: eth(refunded.reduce((sum, job) => sum + BigInt(job.escrow_amount_wei || "0"), 0n)) }
  ];
  return (
    <section className="shell grid gap-8 py-10">
      <h1 className="text-3xl font-black">Client Dashboard</h1>
      <StatsRow stats={stats} />
      <section><h2 className="mb-4 text-2xl font-bold">My Jobs</h2><JobsTable jobs={jobs} /></section>
      <section><h2 className="mb-4 text-2xl font-bold">Pending Applications</h2><JobsTable jobs={jobs.filter((job) => job.status === "Open")} /></section>
      <section><h2 className="mb-4 text-2xl font-bold">Under Review</h2><JobsTable jobs={jobs.filter((job) => job.status === "UnderReview")} /></section>
      <section><h2 className="mb-4 text-2xl font-bold">Recently Completed</h2><JobsTable jobs={completed} /></section>
      <section><h2 className="mb-4 text-2xl font-bold">My Activity</h2><ActivityFeed activities={activities} /></section>
    </section>
  );
}
