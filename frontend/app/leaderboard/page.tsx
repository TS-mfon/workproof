import { LeaderboardRow } from "@/components/leaderboard/LeaderboardRow";
import { EmptyState } from "@/components/shared/EmptyState";
import { getUsers } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const users = await getUsers(100);
  const ranked = users
    .filter((u) => u.reputation_pts > 0 || u.jobs_completed > 0)
    .sort((a, b) => b.reputation_pts - a.reputation_pts);

  return (
    <section className="shell py-12">
      <div style={{ marginBottom: 32 }}>
        <p className="text-xs font-bold uppercase tracking-widest text-accent-strong">Reputation</p>
        <h1 style={{ fontSize: 36, fontWeight: 800, marginTop: 8 }}>Leaderboard</h1>
        <p className="text-sm text-muted" style={{ marginTop: 6 }}>
          Reputation is awarded by the contract on every passed job. Top 10 wallets earn a verified badge.
        </p>
      </div>

      {ranked.length === 0 ? (
        <EmptyState
          title="No ranked freelancers yet"
          message="Complete a job through the AI verifier to land on the board."
          ctaLabel="Find a job"
          ctaHref="/jobs"
        />
      ) : (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Wallet</th>
                <th>Trust score</th>
                <th>Completion rate</th>
                <th>Completed</th>
                <th>Earned</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((user, i) => (
                <LeaderboardRow key={user.wallet_address} user={user} rank={i + 1} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
