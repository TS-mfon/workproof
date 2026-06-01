import { LeaderboardRow } from "@/components/leaderboard/LeaderboardRow";
import { getUsers } from "@/lib/data";

export default async function LeaderboardPage() {
  const users = await getUsers(100);
  return (
    <section className="shell py-10">
      <p className="text-sm font-black uppercase text-blue-600">Onchain reputation</p>
      <h1 className="mb-6 mt-2 text-4xl font-black text-blue-950">Reputation Leaderboard</h1>
      <div className="mb-4 flex flex-wrap gap-2 text-sm font-bold">{["Overall", "Smart Contracts", "Frontend", "Design", "Content", "Marketing"].map((tab) => <span className="rounded-md border border-blue-100 bg-white px-3 py-2 text-blue-800" key={tab}>{tab}</span>)}</div>
      <div className="panel table-wrap"><table><thead><tr><th>Rank</th><th>Wallet</th><th>Domains</th><th>Reputation</th><th>Completed</th><th>Earned</th><th>Win Rate</th></tr></thead><tbody>{users.map((user, index) => <LeaderboardRow key={user.wallet_address} user={user} rank={index + 1} />)}</tbody></table></div>
    </section>
  );
}
