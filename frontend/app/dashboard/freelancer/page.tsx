import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { JobsTable } from "@/components/dashboard/JobsTable";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { getActivities, getJobs, getUsers } from "@/lib/data";
import { eth } from "@/lib/format";

export default async function FreelancerDashboardPage() {
  const [jobs, users, activities] = await Promise.all([getJobs(1000), getUsers(1000), getActivities(20)]);
  const completed = jobs.filter((job) => job.status === "Complete");
  const stats = [
    { label: "Total Jobs Applied", value: jobs.filter((job) => job.freelancer_wallet).length },
    { label: "Active Jobs", value: jobs.filter((job) => job.status === "Active").length },
    { label: "Jobs Under AI Review", value: jobs.filter((job) => job.status === "UnderReview").length },
    { label: "Jobs Passed", value: jobs.filter((job) => job.status === "Passed").length },
    { label: "Jobs Completed", value: completed.length },
    { label: "Total Earned", value: eth(completed.reduce((sum, job) => sum + BigInt(job.reward_amount_wei || "0"), 0n)) },
    { label: "Reputation Points", value: users.reduce((sum, user) => sum + user.reputation_pts, 0) },
    { label: "Current Leaderboard Rank", value: users.length ? "#1 visible in leaderboard" : "Unranked" }
  ];
  return (
    <section className="shell grid gap-8 py-10">
      <h1 className="text-3xl font-black">Freelancer Dashboard</h1>
      <StatsRow stats={stats} />
      <section><h2 className="mb-4 text-2xl font-bold">My Active Jobs</h2><JobsTable jobs={jobs.filter((job) => job.status === "Active" || job.status === "UnderReview")} /></section>
      <section><h2 className="mb-4 text-2xl font-bold">Claimable Rewards</h2><JobsTable jobs={jobs.filter((job) => job.status === "Passed")} /></section>
      <section><h2 className="mb-4 text-2xl font-bold">Retry Needed</h2><JobsTable jobs={jobs.filter((job) => job.status === "Failed" && job.retry_count < 3)} /></section>
      <section><h2 className="mb-4 text-2xl font-bold">Completed Jobs</h2><JobsTable jobs={completed} /></section>
      <section><h2 className="mb-4 text-2xl font-bold">My Reputation History</h2><ActivityFeed activities={activities.filter((a) => a.event_type.includes("reputation") || a.event_type.includes("claim"))} /></section>
      <section><h2 className="mb-4 text-2xl font-bold">My Activity</h2><ActivityFeed activities={activities} /></section>
    </section>
  );
}
