import { UserActions } from "@/components/admin/UserActions";
import { AddressDisplay } from "@/components/shared/AddressDisplay";
import { EthAmount } from "@/components/shared/EthAmount";
import { Mono } from "@/components/shared/Mono";
import { EmptyState } from "@/components/shared/EmptyState";
import { getUsers } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await getUsers(2000);

  if (!users || users.length === 0) {
    return (
      <div className="panel p-8 grid gap-4" style={{ textAlign: "center" }}>
        <h2 className="text-xl font-bold">No users found</h2>
        <p className="text-sm text-muted">
          No users have registered on the protocol yet. Users appear here once they interact on-chain (post a job, apply, submit work, or complete a job).
        </p>
        <div className="mt-2 text-xs text-muted" style={{ background: "var(--surface-soft)", padding: 14, borderRadius: 10 }}>
          <span className="font-bold">Note for Vercel:</span> Supabase tables are not yet applied. The on-chain fallback reads from the contract's <code className="mono" style={{ fontSize: 11 }}>getTopFreelancers</code> view, which only returns wallets with reputation points. Users without reputation will appear once they interact more.
        </div>
      </div>
    );
  }

  return (
    <div className="panel table-wrap">
      <table>
        <thead>
          <tr>
            <th>Wallet</th>
            <th>Role</th>
            <th>XP</th>
            <th>Completed</th>
            <th>Failed</th>
            <th>Earnings</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.wallet_address}>
              <td><Mono><AddressDisplay address={user.wallet_address} /></Mono></td>
              <td style={{ textTransform: "capitalize" }}>{user.role || "—"}</td>
              <td>{user.reputation_pts ?? 0}</td>
              <td>{user.jobs_completed ?? 0}</td>
              <td>{user.jobs_failed ?? 0}</td>
              <td><EthAmount wei={user.total_earned_wei} /></td>
              <td><UserActions wallet={user.wallet_address} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
