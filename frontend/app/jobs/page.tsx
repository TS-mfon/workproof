import Link from "next/link";
import { JobFilters } from "@/components/jobs/JobFilters";
import { getJobs } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const jobs = await getJobs(200);
  return (
    <section className="shell py-12">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 36 }}>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-accent-strong">Marketplace</p>
          <h1 style={{ fontSize: 36, fontWeight: 800, marginTop: 8 }}>Open jobs</h1>
          <p className="text-sm text-muted" style={{ marginTop: 6, maxWidth: 600 }}>
            Real escrow-backed work from the deployed WorkProof contract. Apply with a wallet that meets the criteria.
          </p>
        </div>
        <Link className="btn" href="/jobs/post">Post a job</Link>
      </div>
      <JobFilters jobs={jobs} />
    </section>
  );
}
