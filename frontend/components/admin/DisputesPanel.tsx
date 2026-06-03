"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Mono } from "@/components/shared/Mono";
import { AddressDisplay } from "@/components/shared/AddressDisplay";
import type { Dispute } from "@/lib/types";

export function DisputesPanel() {
  const { address } = useAccount();
  const [items, setItems] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/disputes?status=open")
      .then((r) => r.json())
      .then((d) => setItems(d.disputes ?? []))
      .catch(() => setError("Could not load disputes."))
      .finally(() => setLoading(false));
  }, []);

  async function resolve(id: string, status: "resolved" | "dismissed", resolution: string) {
    if (!address) return;
    await fetch("/api/disputes", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-admin-wallet": address },
      body: JSON.stringify({ id, status, resolution })
    });
    setItems((prev) => prev.filter((d) => d.id !== id));
  }

  if (loading) return <div className="panel p-6">Loading…</div>;
  if (error) return <div className="panel p-6"><p style={{ color: "var(--warn)" }}>{error}</p></div>;
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <div style={{ color: "var(--foreground)", fontWeight: 700 }}>No open disputes</div>
        <div style={{ color: "var(--muted)", marginTop: 6, fontSize: 13 }}>You're caught up.</div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {items.map((d) => (
        <div key={d.id} className="panel p-5 grid gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-wide font-bold" style={{ color: "var(--muted)" }}>Job</div>
              <Link href={`/jobs/${d.job_id_onchain}`}><Mono>{d.job_id_onchain.slice(0, 18)}…</Mono></Link>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide font-bold" style={{ color: "var(--muted)" }}>Opener</div>
              <Mono><AddressDisplay address={d.opener_wallet} /></Mono>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide font-bold" style={{ color: "var(--muted)" }}>Opened</div>
              <span className="text-sm">{new Date(d.created_at).toLocaleString()}</span>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide font-bold" style={{ color: "var(--muted)" }}>Reason</div>
            <p className="text-sm mt-1">{d.reason}</p>
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn ghost tiny" onClick={() => resolve(d.id, "dismissed", "Dismissed — no action needed")}>Dismiss</button>
            <Link className="btn tiny" href={`/jobs/${d.job_id_onchain}`}>Open job & override</Link>
            <button className="btn tiny" onClick={() => resolve(d.id, "resolved", "Resolved by admin")}>Mark resolved</button>
          </div>
        </div>
      ))}
    </div>
  );
}
