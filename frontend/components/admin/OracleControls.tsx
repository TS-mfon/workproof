"use client";

import { useState } from "react";

export function OracleControls() {
  const [message, setMessage] = useState("");
  const oracleUrl = process.env.NEXT_PUBLIC_ORACLE_URL;

  async function post(path: string, label: string) {
    if (!oracleUrl) return setMessage("Oracle URL not configured (NEXT_PUBLIC_ORACLE_URL).");
    try {
      const response = await fetch(`${oracleUrl}${path}`, { method: "POST" });
      setMessage(response.ok ? `${label} triggered` : `${label} failed (${response.status})`);
    } catch (err: any) {
      setMessage(`${label} failed: ${err?.message || "network error"}`);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <button className="btn ghost" onClick={() => post("/admin/force-deadline-check", "Deadline check")}>Force deadline check</button>
      <button className="btn ghost" onClick={() => post("/admin/re-poll-genlayer", "Re-poll GenLayer")}>Re-poll GenLayer</button>
      {message && <span className="text-xs" style={{ color: "var(--muted)" }}>{message}</span>}
    </div>
  );
}
