"use client";

import { useEffect, useState } from "react";
import { useAdminSign } from "@/components/shared/useAdminSign";
import type { Announcement } from "@/lib/types";

export function AnnouncementsPanel() {
  const { sign, ready } = useAdminSign();
  const [active, setActive] = useState<Announcement[]>([]);
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState("info");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/announcements").then((r) => r.json()).then((d) => setActive(d.announcements ?? [])).catch(() => {});
  }, []);

  async function post() {
    if (!ready || !message) return;
    setPosting(true);
    setError("");
    try {
      const auth = await sign("announcement_create", message.slice(0, 64));
      if (!auth) throw new Error("Could not sign — connect a wallet first.");
      const r = await fetch("/api/announcements", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: auth },
        body: JSON.stringify({ message, kind, active: true })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "failed");
      const refreshed = await fetch("/api/announcements").then((r) => r.json());
      setActive(refreshed.announcements ?? []);
      setMessage("");
    } catch (err: any) {
      setError(err?.message || "Could not post — Supabase tables may not be applied yet.");
    } finally {
      setPosting(false);
    }
  }

  async function disable(id: string) {
    if (!ready) return;
    const auth = await sign("announcement_update", id);
    if (!auth) return;
    await fetch("/api/announcements", {
      method: "PATCH",
      headers: { "content-type": "application/json", Authorization: auth },
      body: JSON.stringify({ id, active: false })
    });
    setActive((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="grid gap-6">
      <div className="panel p-6 grid gap-3">
        <h2 className="text-lg font-bold">Post a banner</h2>
        <p className="text-xs" style={{ color: "var(--muted)" }}>Shows site-wide until you turn it off.</p>
        <input className="input" placeholder="Message" value={message} onChange={(e) => setMessage(e.target.value)} />
        <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="info">Info</option>
          <option value="warn">Warning</option>
          <option value="success">Success</option>
        </select>
        <button className="btn" disabled={posting || !message} onClick={post}>{posting ? "Posting…" : "Post"}</button>
        {error && <p className="text-xs" style={{ color: "var(--warn)" }}>{error}</p>}
      </div>

      <div className="panel p-6 grid gap-3">
        <h2 className="text-lg font-bold">Active announcements</h2>
        {active.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>None active.</p>
        ) : (
          <ul className="grid gap-2">
            {active.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg" style={{ background: "var(--surface-soft)", border: "1px solid var(--line)", padding: "10px 14px" }}>
                <span>{a.message}</span>
                <button className="btn ghost tiny" onClick={() => disable(a.id)}>Disable</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
