import Link from "next/link";
import { Activity as ActivityIcon } from "lucide-react";
import type { Activity } from "@/lib/types";
import { shortAddress, timeAgo } from "@/lib/format";

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) return <div className="panel p-6 text-slate-600">No activity yet.</div>;
  return (
    <div className="panel divide-y">
      {activities.map((item) => (
        <div className="flex gap-3 p-4" key={item.id}>
          <ActivityIcon size={18} className="mt-1 text-teal-800" />
          <div>
            <p className="font-semibold">{item.event_type.replaceAll("_", " ")}</p>
            <p className="text-sm text-slate-600">
              {shortAddress(item.actor_wallet)} {item.job_id && <Link className="text-teal-800" href={`/jobs/${item.job_id}`}>view job</Link>} · {timeAgo(item.created_at)}
            </p>
            {item.tx_hash && <a className="text-sm text-teal-800" href={`https://sepolia.arbiscan.io/tx/${item.tx_hash}`} target="_blank">Arbiscan</a>}
          </div>
        </div>
      ))}
    </div>
  );
}
