import { AddressDisplay } from "@/components/shared/AddressDisplay";
import { EthAmount } from "@/components/shared/EthAmount";
import { getUsers } from "@/lib/data";

export default async function AdminUsersPage() {
  const users = await getUsers(1000);
  return <section className="shell py-10"><h1 className="mb-6 text-3xl font-black">User Management</h1><div className="panel table-wrap"><table><thead><tr><th>Wallet</th><th>Role</th><th>Reputation</th><th>Jobs</th><th>Earnings</th><th>Ban</th></tr></thead><tbody>{users.map((user) => <tr key={user.wallet_address}><td><AddressDisplay address={user.wallet_address} /></td><td>{user.role}</td><td>{user.reputation_pts}</td><td>{user.jobs_completed}</td><td><EthAmount wei={user.total_earned_wei} /></td><td>{user.banned ? "Banned" : "Active"}</td></tr>)}</tbody></table></div></section>;
}
