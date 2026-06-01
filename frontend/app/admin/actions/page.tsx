import { getSupabaseServer } from "@/lib/supabase";

export default async function AdminActionsPage() {
  const supabase = getSupabaseServer();
  const { data } = supabase ? await supabase.from("admin_actions").select("*").order("created_at", { ascending: false }).limit(100) : { data: [] };
  return <section className="shell py-10"><h1 className="mb-6 text-3xl font-black">Admin Actions Log</h1><div className="panel table-wrap"><table><thead><tr><th>Admin</th><th>Action</th><th>Target</th><th>Reason</th><th>Tx</th></tr></thead><tbody>{(data ?? []).map((action: any) => <tr key={action.id}><td>{action.admin_wallet}</td><td>{action.action_type}</td><td>{action.target_id}</td><td>{action.reason}</td><td>{action.tx_hash}</td></tr>)}</tbody></table></div></section>;
}
