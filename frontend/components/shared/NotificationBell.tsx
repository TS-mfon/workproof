"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";

type Notification = {
  id: string;
  kind: string;
  job_id?: string | null;
  payload?: Record<string, unknown> | null;
  seen_at?: string | null;
  created_at: string;
};

export function NotificationBell() {
  const { address } = useAccount();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!address) { setItems([]); return; }
    try {
      const res = await fetch(`/api/notifications?wallet=${address}`, { cache: "no-store" });
      const body = await res.json();
      setItems(body.notifications ?? []);
    } catch { /* ignore */ }
  }, [address]);

  useEffect(() => {
    load();
    const t = setInterval(load, 45_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unseen = items.filter((n) => !n.seen_at).length;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unseen > 0 && address) {
      // Optimistically clear, then persist.
      setItems((prev) => prev.map((n) => ({ ...n, seen_at: n.seen_at ?? new Date().toISOString() })));
      try {
        await fetch("/api/notifications", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "mark-seen", wallet: address })
        });
      } catch { /* ignore */ }
    }
  }

  if (!address) return null;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        aria-label="Notifications"
        className="btn ghost tiny"
        onClick={toggle}
        style={{ position: "relative", padding: "6px 10px" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unseen > 0 && (
          <span style={{ position: "absolute", top: -4, right: -4, background: "var(--danger)", color: "white", borderRadius: 999, fontSize: 10, lineHeight: "16px", minWidth: 16, height: 16, textAlign: "center", padding: "0 4px" }}>
            {unseen > 9 ? "9+" : unseen}
          </span>
        )}
      </button>

      {open && (
        <div
          className="panel"
          style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 320, maxHeight: 400, overflowY: "auto", zIndex: 200, padding: 8 }}
        >
          {items.length === 0 ? (
            <p className="text-xs text-muted" style={{ padding: 12 }}>No notifications yet.</p>
          ) : (
            items.map((n) => (
              <div key={n.id} className="rounded-lg" style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)" }}>
                <div className="text-sm">{String(n.payload?.message ?? n.kind)}</div>
                <div className="text-xs text-muted" style={{ marginTop: 2 }}>{new Date(n.created_at).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
