"use client";

import { useState } from "react";

export function OracleControls() {
  const [message, setMessage] = useState("");
  const oracleUrl = process.env.NEXT_PUBLIC_ORACLE_URL;
  async function post(path: string) {
    if (!oracleUrl) return setMessage("NEXT_PUBLIC_ORACLE_URL is not configured.");
    const response = await fetch(`${oracleUrl}${path}`, { method: "POST" });
    setMessage(response.ok ? "Oracle trigger accepted." : `Oracle trigger failed: ${response.status}`);
  }
  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn" onClick={() => post("/admin/force-deadline-check")}>Force Deadline Check</button>
      <button className="btn secondary" onClick={() => post("/admin/re-poll-genlayer")}>Re-poll GenLayer</button>
      {message && <p className="text-sm text-slate-700">{message}</p>}
    </div>
  );
}
