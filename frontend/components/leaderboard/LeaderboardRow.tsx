import Link from "next/link";
import type { UserProfile } from "@/lib/types";
import { AddressDisplay } from "@/components/shared/AddressDisplay";
import { EthAmount } from "@/components/shared/EthAmount";

export function LeaderboardRow({ user, rank }: { user: UserProfile; rank: number }) {
  const attempted = user.jobs_completed + user.jobs_failed;
  const winRate = attempted === 0 ? 0 : Math.round((user.jobs_completed / attempted) * 100);
  return (
    <tr className={rank <= 3 ? "bg-blue-50/70" : ""}>
      <td><span className="rounded-lg bg-blue-600 px-2 py-1 text-xs font-black text-white">#{rank}</span></td>
      <td><Link className="mono font-bold text-blue-700" href={`/profile/${user.wallet_address}`}><AddressDisplay address={user.wallet_address} /></Link></td>
      <td className="text-slate-600">{user.domains?.join(", ") || "General"}</td>
      <td className="font-black text-slate-950">{user.reputation_pts}</td>
      <td className="text-slate-600">{user.jobs_completed}</td>
      <td className="text-slate-600"><EthAmount wei={user.total_earned_wei} /></td>
      <td className="text-slate-600">{winRate}%</td>
    </tr>
  );
}
