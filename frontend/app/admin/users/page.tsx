import { UserActions } from "@/components/admin/UserActions";
import { AddressDisplay } from "@/components/shared/AddressDisplay";
import { EthAmount } from "@/components/shared/EthAmount";
import { Mono } from "@/components/shared/Mono";
import { getUsers } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await getUsers(2000);
  return (
    <div className="panel table-wrap">
      <table>
        <thead>
          <tr>
            <th>Wallet</th>
            <th>Role</th>
            <th>XP</th>
            <th>Jobs</th>
            <th>Earnings</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.wallet_address}>
              <td><Mono><AddressDisplay address={user.wallet_address} /></Mono></td>
              <td style={{ textTransform: "capitalize" }}>{user.role}</td>
              <td>{user.reputation_pts}</td>
              <td>{user.jobs_completed}</td>
              <td><EthAmount wei={user.total_earned_wei} /></td>
              <td><UserActions wallet={user.wallet_address} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
