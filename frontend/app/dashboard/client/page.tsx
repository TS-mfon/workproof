import { ClientDashboard } from "@/components/dashboard/ClientDashboard";

export const dynamic = "force-dynamic";

export default function ClientDashboardPage() {
  return (
    <section className="shell py-12 grid gap-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent-strong">Client</p>
        <h1 className="text-3xl font-bold mt-2">Your jobs</h1>
      </div>
      <ClientDashboard />
    </section>
  );
}
