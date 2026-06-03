"use client";

import { FormEvent, useState } from "react";
import { useWriteContract } from "wagmi";
import { workProofAbi, workProofAddress } from "@/lib/contracts";
import { useTx } from "@/components/shared/TxToast";

export function SubmitDeliverableModal({
  jobId,
  open,
  onClose,
  onSubmitted,
  retry = false
}: {
  jobId: string;
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
  retry?: boolean;
}) {
  const { writeContractAsync, isPending } = useWriteContract();
  const { run } = useTx();
  const [url, setUrl] = useState("");

  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const addr = workProofAddress;
    if (!addr || !url) return;
    const hash = await run({
      label: retry ? "Resubmitting deliverable" : "Submitting deliverable",
      pending: "Sending to AI review…",
      success: "Submitted for AI review",
      write: () => writeContractAsync({
        address: addr,
        abi: workProofAbi,
        functionName: "submitWork",
        args: [jobId as `0x${string}`, url]
      })
    });
    if (hash) {
      onSubmitted?.();
      onClose();
      setTimeout(() => location.reload(), 1500);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(7, 7, 11, 0.65)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 20
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        onSubmit={submit}
        className="panel grid gap-4 p-6"
        style={{ width: "100%", maxWidth: 480 }}
      >
        <div>
          <h2 className="text-lg font-bold">{retry ? "Resubmit deliverable" : "Submit deliverable"}</h2>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Paste a public URL to your work — Gist, Notion, Figma share link, deployed preview. The AI verifier reads what's at the URL.
          </p>
        </div>
        <input
          className="input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://"
          required
          autoFocus
          type="url"
        />
        <div className="flex gap-2 justify-end">
          <button type="button" className="btn ghost" onClick={onClose} disabled={isPending}>Cancel</button>
          <button className="btn" disabled={isPending || !url}>{isPending ? "Submitting…" : retry ? "Resubmit" : "Submit"}</button>
        </div>
      </form>
    </div>
  );
}
