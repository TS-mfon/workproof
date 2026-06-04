import Link from "next/link";
import type { UserProfile } from "@/lib/types";
import { AddressDisplay } from "@/components/shared/AddressDisplay";
import { EthAmount } from "@/components/shared/EthAmount";

export function LeaderboardRow({ user, rank }: { user: UserProfile; rank: number }) {
  const attempted = user.jobs_completed + user.jobs_failed;
  const completion = attempted === 0 ? 0 : Math.round((user.jobs_completed / attempted) * 100);
  const verified = rank <= 10;
  return (
    <tr>
      <td>
        <span style={{
          background: rank <= 3 ? "var(--accent)" : "var(--surface-soft)",
          color: rank <= 3 ? "white" : "var(--muted-strong)",
          padding: "4px 10px",
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 12
        }}>
          #{rank}
        </span>
      </td>
      <td>
        <Link className="mono" href={`/profile/${user.wallet_address}`} style={{ color: "var(--accent-strong)", fontWeight: 600 }}>
          <AddressDisplay address={user.wallet_address} />
        </Link>
        {verified && <span className="verified-badge" style={{ marginLeft: 8 }}>✓ Verified</span>}
      </td>
      <td><b>{user.reputation_pts}</b></td>
      <td>{completion}%</td>
      <td>{user.jobs_completed}</td>
      <td><EthAmount wei={user.total_earned_wei} /></td>
    </tr>
  );
}
