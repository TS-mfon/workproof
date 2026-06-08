"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { parseEventLogs } from "viem";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { arbitrumSepolia } from "viem/chains";
import { workProofAbi, workProofAddress } from "@/lib/contracts";
import { useTx } from "@/components/shared/TxToast";

const SUPPORTED_DOMAINS = ["content", "frontend", "design", "marketing", "research", "smart-contracts"];

const UNVERIFIABLE_HOSTS = [
  "twitter.com", "x.com", "instagram.com", "facebook.com", "linkedin.com",
  "tiktok.com", "reddit.com", "youtube.com", "pinterest.com",
  "app.slack.com", "teams.microsoft.com", "discord.com", "discord.gg",
  "drive.google.com", "docs.google.com", "calendly.com", "zoom.us",
  "notion.so", "notion.com", "app.notion.com", "www.notion.com"
];

type Stage = "idle" | "arbitrum" | "genlayer" | "done";

const ERROR_COPY: Record<string, string> = {
  rate_limited: "The AI reviewer is busy right now. Please retry in about a minute.",
  oracle_misconfigured: "AI reviewer is offline (oracle not configured). Contact support — your Arbitrum submission is saved.",
  rpc_unreachable: "GenLayer studionet is unreachable. Your Arbitrum submission is saved — retry shortly.",
  contract_revert: "The AI reviewer contract rejected the call. Double-check your URL and try again.",
  timeout: "GenLayer took too long to respond. Your Arbitrum submission is saved — retry shortly.",
  invalid_input: "Something is wrong with the submission payload. Please refresh and try again.",
  unknown: "AI reviewer call failed. Your Arbitrum submission is saved — retry shortly.",
  network_error: "Network error reaching the AI reviewer. Check your connection and retry."
};

export function SubmitDeliverableModal({
  jobId,
  criteria,
  domain,
  open,
  onClose,
  onSubmitted,
  retry = false
}: {
  jobId: string;
  criteria?: string;
  domain?: string;
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
  retry?: boolean;
}) {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const { run } = useTx();
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [glTxId, setGlTxId] = useState<string | null>(null);
  const inFlight = useRef(false);

  const domainSupported = domain ? SUPPORTED_DOMAINS.includes(domain) : true;

  const verifiableMessage = useMemo(() => {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");
      for (const blocked of UNVERIFIABLE_HOSTS) {
        if (host.endsWith(blocked)) return `GenLayer validators cannot access ${host} — it requires login or blocks automated fetches. Use a public Gist, GitHub Pages, or a deployed website.`;
      }
      return null;
    } catch {
      return null;
    }
  }, [url]);

  const isValidUrl = useMemo(() => {
    try {
      const u = new URL(url);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, [url]);

  if (!open) return null;

  const submitDisabled =
    !isValidUrl ||
    Boolean(verifiableMessage) ||
    isPending ||
    stage !== "idle" ||
    inFlight.current;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Synchronous double-click guard — set BEFORE any await
    if (inFlight.current) return;
    inFlight.current = true;
    setUrlError("");

    try {
      if (chainId !== arbitrumSepolia.id) {
        setUrlError("You must be connected to Arbitrum Sepolia. Switch your wallet network.");
        return;
      }
      const addr = workProofAddress;
      if (!addr || !url || !address) return;
      if (!criteria) {
        setUrlError("Acceptance criteria are unavailable for this job.");
        return;
      }
      if (verifiableMessage) {
        setUrlError(verifiableMessage);
        return;
      }

      // ---- Stage 1: user signs Arbitrum submitWork ----
      setStage("arbitrum");
      const hash = await run({
        label: retry ? "Resubmitting deliverable" : "Submitting deliverable",
        pending: "Confirming on Arbitrum…",
        success: "Recorded — handing off to AI reviewer",
        write: () => writeContractAsync({
          address: addr,
          abi: workProofAbi,
          functionName: "submitWork",
          args: [jobId as `0x${string}`, url]
        })
      });
      if (!hash || !publicClient) {
        setStage("idle");
        return;
      }

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const logs = parseEventLogs({ abi: workProofAbi, eventName: "SubmissionRecorded", logs: receipt.logs });
      const recorded = logs[0]?.args;
      if (!recorded?.submissionId) {
        setUrlError("Submission was recorded on Arbitrum but its ID could not be read. Use the job page to retry the AI review.");
        setStage("idle");
        return;
      }

      // ---- Stage 2: oracle signs GenLayer verify_submission ----
      setStage("genlayer");
      let res: Response;
      try {
        res = await fetch("/api/genlayer-trigger", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jobId,
            submissionId: recorded.submissionId,
            freelancer: address,
            deliverableUrl: url,
            criteria,
            attempt: Number(recorded.attempt)
          })
        });
      } catch {
        setUrlError(`${ERROR_COPY.network_error} Your Arbitrum submission is saved.`);
        setStage("idle");
        return;
      }

      let payload: { ok?: boolean; code?: string; error?: string; glTxId?: string } = {};
      try { payload = await res.json(); } catch { /* swallow */ }

      if (!res.ok || !payload.ok) {
        const code = payload.code ?? "unknown";
        const copy = ERROR_COPY[code] ?? payload.error ?? ERROR_COPY.unknown;
        setUrlError(`${copy} Your Arbitrum submission is saved — use Complete GenLayer Review on the job page to retry.`);
        setStage("idle");
        return;
      }

      setGlTxId(payload.glTxId ?? null);
      setStage("done");
      onSubmitted?.();
      setTimeout(() => {
        onClose();
        location.reload();
      }, 1500);
    } catch (error) {
      setUrlError(error instanceof Error
        ? `${error.message} Your Arbitrum submission may be saved — check the job page.`
        : "Submission failed unexpectedly.");
      setStage("idle");
    } finally {
      // Only release the lock if we didn't reach success — on success the modal closes.
      if (stage !== "done") {
        inFlight.current = false;
      }
    }
  }

  const buttonLabel =
    stage === "arbitrum" ? "Recording on Arbitrum…"
    : stage === "genlayer" ? "Sending to AI reviewer…"
    : stage === "done" ? "Submitted ✓"
    : retry ? "Resubmit" : "Submit & verify";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 20
      }}
      onClick={(e) => { if (e.target === e.currentTarget && stage === "idle") onClose(); }}
    >
      <form
        onSubmit={submit}
        className="panel grid gap-5 p-6"
        style={{ width: "100%", maxWidth: 520 }}
      >
        <div>
          <h2 className="text-xl font-bold">{retry ? "Resubmit deliverable" : "Submit deliverable"}</h2>
          <p className="text-sm mt-2 text-muted">
            Paste a public URL to your work. The oracle will hand it off to GenLayer validators — you only sign one Arbitrum transaction.
          </p>
        </div>

        {!domainSupported && (
          <div style={{ background: "var(--warn-soft)", border: "1px solid #FDE68A", borderRadius: 10, padding: 12, fontSize: 13, color: "#92400E" }}>
            ⚠ This job domain ({domain}) may not be supported by GenLayer for verification. Consider a {SUPPORTED_DOMAINS.slice(0, -1).join(", ")}, or {SUPPORTED_DOMAINS.slice(-1)} job instead.
          </div>
        )}

        <div className="grid gap-1">
          <label>Deliverable URL</label>
          <input
            className="input"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setUrlError(""); }}
            placeholder="https://gist.github.com/your-username/your-work"
            required
            autoFocus
            disabled={stage !== "idle"}
            type="url"
          />
        </div>

        {verifiableMessage && (
          <div style={{ background: "var(--warn-soft)", border: "1px solid #FDE68A", borderRadius: 10, padding: 12, fontSize: 13, color: "#92400E" }}>
            ⚠ {verifiableMessage}
          </div>
        )}

        {stage === "arbitrum" && <p className="text-xs text-muted">Step 1 of 2 · Recording your submission on Arbitrum…</p>}
        {stage === "genlayer" && <p className="text-xs text-muted">Step 2 of 2 · Oracle is handing it off to the AI reviewer…</p>}
        {stage === "done" && glTxId && (
          <p className="text-xs" style={{ color: "var(--success, #059669)" }}>
            Submitted ✓ — GenLayer tx <code>{glTxId.slice(0, 10)}…</code>
          </p>
        )}

        {urlError && (
          <p className="text-xs" style={{ color: "var(--danger)" }}>{urlError}</p>
        )}

        <div className="flex gap-2 justify-end">
          <button type="button" className="btn ghost" onClick={onClose} disabled={stage !== "idle"}>Cancel</button>
          <button className="btn" disabled={submitDisabled}>
            {buttonLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
