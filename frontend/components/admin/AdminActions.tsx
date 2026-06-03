"use client";

import { useState } from "react";
import { useWriteContract } from "wagmi";
import { workProofAbi, workProofAddress } from "@/lib/contracts";
import { useTx } from "@/components/shared/TxToast";

export function AdminActions({ jobId, status }: { jobId: string; status?: string }) {
  const { writeContractAsync, isPending } = useWriteContract();
  const { run } = useTx();
  const [openOverride, setOpenOverride] = useState(false);
  const [openRefund, setOpenRefund] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  async function pause() {
    const addr = workProofAddress;
    if (!addr) return;
    await run({
      label: "Pausing job",
      success: "Job paused",
      write: () => writeContractAsync({ address: addr, abi: workProofAbi, functionName: "pauseJob", args: [jobId as `0x${string}`, true] })
    });
  }

  async function unpause() {
    const addr = workProofAddress;
    if (!addr) return;
    await run({
      label: "Unpausing job",
      success: "Job unpaused",
      write: () => writeContractAsync({ address: addr, abi: workProofAbi, functionName: "pauseJob", args: [jobId as `0x${string}`, false] })
    });
  }

  const terminal = status === "Complete" || status === "Refunded" || status === "Deleted";

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <button className="btn ghost tiny" disabled={isPending} onClick={pause}>Pause</button>
      <button className="btn ghost tiny" disabled={isPending} onClick={unpause}>Unpause</button>
      <button className="btn ghost tiny" disabled={isPending || terminal} onClick={() => setOpenRefund(true)}>Force Refund</button>
      <button className="btn ghost tiny" disabled={isPending || !!status && (status === "Complete" || status === "Refunded" || status === "Deleted")} onClick={() => setOpenOverride(true)}>Override AI</button>
      <button className="btn danger tiny" disabled={isPending || terminal} onClick={() => setOpenDelete(true)}>Delete</button>

      <ReasonModal
        open={openRefund}
        title="Force refund"
        verb="Force Refund"
        body="The escrow returns to the client. Use when both parties agree to cancel."
        onClose={() => setOpenRefund(false)}
        onConfirm={async (reason) => {
          const addr = workProofAddress;
          if (!addr) return;
          await run({
            label: "Forcing refund",
            success: "Refund issued",
            write: () => writeContractAsync({ address: addr, abi: workProofAbi, functionName: "adminForceRefund", args: [jobId as `0x${string}`, reason] })
          });
        }}
      />

      <ReasonModal
        open={openDelete}
        title="Delete job"
        verb="Delete"
        danger
        body="Marks the job as Deleted and refunds the client's escrow. The job is hidden from the public feed."
        onClose={() => setOpenDelete(false)}
        onConfirm={async (reason) => {
          const addr = workProofAddress;
          if (!addr) return;
          await run({
            label: "Deleting job",
            success: "Job deleted",
            write: () => writeContractAsync({ address: addr, abi: workProofAbi, functionName: "deleteJob", args: [jobId as `0x${string}`, reason] })
          });
        }}
      />

      <OverrideModal
        open={openOverride}
        onClose={() => setOpenOverride(false)}
        onConfirm={async (passed, pct, reasoning) => {
          const addr = workProofAddress;
          if (!addr) return;
          await run({
            label: passed ? "Overriding to Passed" : "Overriding to Failed",
            success: "Verdict overridden",
            write: () => writeContractAsync({ address: addr, abi: workProofAbi, functionName: "overrideVerdict", args: [jobId as `0x${string}`, passed, pct, reasoning] })
          });
        }}
      />
    </div>
  );
}

function ReasonModal({
  open, title, verb, body, danger, onClose, onConfirm
}: {
  open: boolean; title: string; verb: string; body: string; danger?: boolean; onClose: () => void; onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (!open) return null;
  return (
    <ModalShell onClose={onClose}>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{body}</p>
      <input className="input" autoFocus placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        <button
          className={`btn ${danger ? "danger" : ""}`}
          disabled={submitting || reason.length < 3}
          onClick={async () => {
            setSubmitting(true);
            try { await onConfirm(reason); onClose(); } finally { setSubmitting(false); }
          }}
        >{verb}</button>
      </div>
    </ModalShell>
  );
}

function OverrideModal({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (passed: boolean, pct: number, reasoning: string) => Promise<void>; }) {
  const [passed, setPassed] = useState(true);
  const [pct, setPct] = useState(100);
  const [reasoning, setReasoning] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (!open) return null;
  return (
    <ModalShell onClose={onClose}>
      <h2 className="text-lg font-bold">Override AI verdict</h2>
      <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Use only after manual review (e.g. resolving a dispute).</p>

      <div className="flex gap-2">
        <button type="button" className={`btn ${passed ? "" : "ghost"}`} onClick={() => setPassed(true)}>Pass</button>
        <button type="button" className={`btn ${!passed ? "danger" : "ghost"}`} onClick={() => setPassed(false)}>Fail</button>
      </div>

      {passed && (
        <div className="grid gap-1">
          <label className="text-xs font-bold uppercase tracking-wide text-muted">Payment percentage</label>
          <input className="input" type="number" min={1} max={100} value={pct} onChange={(e) => setPct(Number(e.target.value))} />
        </div>
      )}

      <textarea className="textarea" placeholder="Reasoning (recorded on-chain)" value={reasoning} onChange={(e) => setReasoning(e.target.value)} />

      <div className="flex gap-2 justify-end">
        <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        <button
          className="btn"
          disabled={submitting || reasoning.length < 5}
          onClick={async () => {
            setSubmitting(true);
            try { await onConfirm(passed, passed ? pct : 0, reasoning); onClose(); } finally { setSubmitting(false); }
          }}
        >Override</button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(7,7,11,0.65)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="panel p-6 grid gap-4" style={{ width: "100%", maxWidth: 480 }}>
        {children}
      </div>
    </div>
  );
}
