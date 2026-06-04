import { FreelancerDashboard } from "@/components/dashboard/FreelancerDashboard";

export const dynamic = "force-dynamic";

export default function FreelancerDashboardPage() {
  return (
    <section className="shell py-12 grid gap-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent-strong">Freelancer</p>
        <h1 className="text-3xl font-bold mt-2">Your work</h1>
      </div>
      <FreelancerDashboard />
    </section>
  );
}
