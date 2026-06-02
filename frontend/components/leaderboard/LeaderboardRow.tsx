import Link from "next/link";
import type { UserProfile } from "@/lib/types";
import { AddressDisplay } from "@/components/shared/AddressDisplay";
import { EthAmount } from "@/components/shared/EthAmount";

export function LeaderboardRow({ user, rank }: { user: UserProfile; rank: number }) {
  const attempted = user.jobs_completed + user.jobs_failed;
  const winRate = attempted === 0 ? 0 : Math.round((user.jobs_completed / attempted) * 100);
  return (
    <tr className={rank <= 3 ? "bg-cyan-300/5" : ""}>
      <td><span className="rounded-[4px] border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-xs font-black text-cyan-300">#{rank}</span></td>
      <td><Link className="font-bold text-cyan-300" href={`/profile/${user.wallet_address}`}><AddressDisplay address={user.wallet_address} /></Link></td>
      <td className="text-slate-300">{user.domains?.join(", ") || "General"}</td>
      <td className="font-black text-white">{user.reputation_pts}</td>
      <td className="text-slate-300">{user.jobs_completed}</td>
      <td className="text-slate-300"><EthAmount wei={user.total_earned_wei} /></td>
      <td className="text-slate-300">{winRate}%</td>
    </tr>
  );
}
