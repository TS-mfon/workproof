"use client";

import { useEffect, useState } from "react";
import { AddressDisplay } from "@/components/shared/AddressDisplay";

type Row = {
  job_id: string;
  submission_id: string;
  gl_tx_id: string;
  oracle_address: string;
  attempt: number;
  signed_at: string;
  jobs?: { title?: string; status?: string; ai_verdict?: Record<string, unknown> | null } | null;
};

const GENLAYER_EXPLORER = "https://genlayer-explorer.vercel.app/tx";

export function OracleVerifications() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/genlayer-submissions/list?limit=100", { cache: "no-store" });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error ?? "Failed to load");
      setRows(body.submissions ?? []);
    } catch (e) {
      setError((e as Error).message);
      setRows([]);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  if (rows === null) return <p className="text-sm text-muted">Loading GenLayer verifications…</p>;
  if (error) return <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>;
  if (rows.length === 0) return <p className="text-sm text-muted">No GenLayer verifications yet. When a freelancer submits work, the oracle wallet signs the GenLayer review and it appears here.</p>;

  return (
    <div className="grid gap-2">
      {rows.map((r) => {
        const verdict = r.jobs?.ai_verdict as { meets_criteria?: boolean; quality_score?: number } | null | undefined;
        const verdictLabel = verdict?.meets_criteria === true ? `Passed ${verdict.quality_score ?? ""}` : verdict?.meets_criteria === false ? "Failed" : "Pending";
        return (
          <div key={`${r.submission_id}-${r.attempt}`} className="rounded-lg border p-3 grid gap-1" style={{ borderColor: "var(--line)", background: "var(--surface-soft)" }}>
            <div className="flex justify-between gap-3 flex-wrap items-center">
              <strong className="text-sm">{r.jobs?.title ?? "Job"}</strong>
              <span className="status-badge" data-state={verdict?.meets_criteria ? "passed" : verdict?.meets_criteria === false ? "failed" : "under-review"}>
                <span className="dot" /> {verdictLabel}
              </span>
            </div>
            <div className="text-xs text-muted flex flex-wrap gap-x-4 gap-y-1">
              <span>attempt {r.attempt}</span>
              <span>oracle <AddressDisplay address={r.oracle_address} /></span>
              <span>{new Date(r.signed_at).toLocaleString()}</span>
            </div>
            <a className="mono text-xs break-all" style={{ color: "var(--accent)" }} href={`${GENLAYER_EXPLORER}/${r.gl_tx_id}`} target="_blank" rel="noreferrer">
              {r.gl_tx_id}
            </a>
          </div>
        );
      })}
    </div>
  );
}
