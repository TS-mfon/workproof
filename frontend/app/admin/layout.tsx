import { AdminGate } from "@/components/admin/AdminGate";
import { AdminNav } from "@/components/admin/AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGate>
      <section className="shell py-8 grid gap-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--accent)" }}>Admin command center</p>
          <h1 className="text-3xl font-black mt-1">WorkProof Operations</h1>
        </div>
        <AdminNav />
        {children}
      </section>
    </AdminGate>
  );
}
