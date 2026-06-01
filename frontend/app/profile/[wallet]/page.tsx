import { JobsTable } from "@/components/dashboard/JobsTable";
import { AddressDisplay } from "@/components/shared/AddressDisplay";
import { EthAmount } from "@/components/shared/EthAmount";
import { getJobs } from "@/lib/data";
import { getSupabaseServer } from "@/lib/supabase";

export default async function ProfilePage({ params }: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await params;
  const supabase = getSupabaseServer();
  const { data: user } = supabase ? await supabase.from("users").select("*").eq("wallet_address", wallet).maybeSingle() : { data: null };
  const jobs = (await getJobs(1000)).filter((job) => job.client_wallet.toLowerCase() === wallet.toLowerCase() || job.freelancer_wallet?.toLowerCase() === wallet.toLowerCase());
  return (
    <section className="shell grid gap-8 py-10">
      <div className="panel p-6"><h1 className="text-3xl font-black">{user?.display_name || <AddressDisplay address={wallet} />}</h1><p className="mt-2 text-slate-600">{user?.bio || "Public WorkProof profile"}</p><div className="mt-4 grid-auto"><p><b>Reputation:</b> {user?.reputation_pts ?? 0}</p><p><b>Completed:</b> {user?.jobs_completed ?? 0}</p><p><b>Earned:</b> <EthAmount wei={user?.total_earned_wei || "0"} /></p></div></div>
      <section><h2 className="mb-4 text-2xl font-bold">Jobs</h2><JobsTable jobs={jobs} /></section>
    </section>
  );
}
