import Link from "next/link";
import type { Activity } from "@/lib/types";
import { shortAddress, timeAgo } from "@/lib/format";

const EVENT_LABEL: Record<string, string> = {
  job_posted: "Job posted",
  application_submitted: "Applied for job",
  job_accepted: "Freelancer accepted",
  work_submitted: "Work submitted",
  verdict_pass: "AI verdict — Passed",
  verdict_fail: "AI verdict — Failed",
  verdict_override_pass: "Admin override — Passed",
  verdict_override_fail: "Admin override — Failed",
  reward_claimed: "Reward claimed",
  refund_issued: "Refund issued",
  job_deleted: "Job removed by admin",
  escrow_topped_up: "Escrow topped up",
  wallet_banned: "Wallet banned",
  wallet_unbanned: "Wallet unbanned"
};

const EVENT_COLOR: Record<string, string> = {
  job_posted: "var(--accent)",
  application_submitted: "var(--accent)",
  job_accepted: "var(--accent-strong)",
  work_submitted: "var(--warn)",
  verdict_pass: "var(--success)",
  verdict_fail: "var(--danger)",
  verdict_override_pass: "var(--success)",
  verdict_override_fail: "var(--danger)",
  reward_claimed: "var(--success)",
  refund_issued: "var(--muted-strong)",
  job_deleted: "var(--danger)",
  escrow_topped_up: "var(--accent)",
  wallet_banned: "var(--danger)",
  wallet_unbanned: "var(--accent)"
};

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return <div className="empty-state"><h3>No activity yet</h3><p>Protocol events appear here as they happen.</p></div>;
  }
  return (
    <div className="panel" style={{ overflow: "hidden" }}>
      {activities.map((item, i) => {
        const label = EVENT_LABEL[item.event_type] ?? item.event_type.replaceAll("_", " ");
        const color = EVENT_COLOR[item.event_type] ?? "var(--muted)";
        const isValidJobLink = item.job_id?.startsWith("0x") && item.job_id.length === 66;
        return (
          <div
            key={item.id}
            style={{
              display: "grid",
              gridTemplateColumns: "10px 1fr auto",
              gap: 14,
              padding: "16px 20px",
              borderTop: i === 0 ? "none" : "1px solid var(--line)",
              alignItems: "center"
            }}
          >
            <span style={{ background: color, borderRadius: 999, width: 8, height: 8 }} />
            <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: "var(--foreground)", fontSize: 14 }}>{label}</div>
              <div className="mono text-muted" style={{ fontSize: 12 }}>
                {shortAddress(item.actor_wallet)}
                {isValidJobLink && (
                  <>
                    {" · "}
                    <Link href={`/jobs/${item.job_id}`} style={{ color: "var(--accent-strong)", fontWeight: 600 }}>view job</Link>
                  </>
                )}
                {" · "}
                <span style={{ color: "var(--muted)" }}>{timeAgo(item.created_at)}</span>
              </div>
            </div>
            {item.tx_hash && (
              <a
                href={`https://sepolia.arbiscan.io/tx/${item.tx_hash}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-strong)", letterSpacing: "0.04em", textTransform: "uppercase" }}
              >
                Arbiscan ↗
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
