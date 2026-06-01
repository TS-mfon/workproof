import { getJob } from "@/lib/data";
import { JobActionPanel } from "@/components/jobs/JobActionPanel";

export default async function ApplyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  return <section className="shell max-w-2xl py-10"><h1 className="mb-6 text-3xl font-black">Apply for Job</h1>{job ? <JobActionPanel job={job} /> : <div className="panel p-6">Job not found.</div>}</section>;
}
