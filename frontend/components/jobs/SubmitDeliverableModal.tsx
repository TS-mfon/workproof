"use client";

import { FormEvent, useMemo, useState } from "react";
import { parseEventLogs } from "viem";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { arbitrumSepolia } from "viem/chains";
import { workProofAbi, workProofAddress } from "@/lib/contracts";
import { useTx } from "@/components/shared/TxToast";
import { verifySubmission } from "@/lib/genlayer";

const SUPPORTED_DOMAINS = ["content", "frontend", "design", "marketing", "research", "smart-contracts"];

// Hosts known to block crawlers / require login
const UNVERIFIABLE_HOSTS = [
  "twitter.com", "x.com", "instagram.com", "facebook.com", "linkedin.com",
  "tiktok.com", "reddit.com", "youtube.com", "pinterest.com",
  "app.slack.com", "teams.microsoft.com", "discord.com", "discord.gg",
  "drive.google.com", "docs.google.com", "calendly.com", "zoom.us",
  "notion.so", "notion.com", "app.notion.com", "www.notion.com"
];

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
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const { run } = useTx();
  const [url, setUrl] = useState("");
  const [checkingUrl, setCheckingUrl] = useState(false);
  const [urlError, setUrlError] = useState("");
  const [stage, setStage] = useState<"idle" | "arbitrum" | "genlayer">("idle");

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

  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUrlError("");

    if (chainId !== arbitrumSepolia.id) {
      setUrlError("You must be connected to Arbitrum Sepolia to submit work. Switch your wallet network.");
      return;
    }
    const addr = workProofAddress;
    if (!addr || !url) return;

    // Warn if URL is likely unverifiable but don't block
    if (verifiableMessage) {
      setUrlError(verifiableMessage);
      return;
    }

    setStage("arbitrum");
    const hash = await run({
      label: retry ? "Resubmitting deliverable" : "Submitting deliverable",
      pending: "Confirming on Arbitrum…",
      success: "Submitted for AI review",
      write: () => writeContractAsync({
        address: addr,
        abi: workProofAbi,
        functionName: "submitWork",
        args: [jobId as `0x${string}`, url]
      })
    });
    if (!hash || !publicClient || !address) {
      setStage("idle");
      return;
    }

    try {
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const logs = parseEventLogs({ abi: workProofAbi, eventName: "SubmissionRecorded", logs: receipt.logs });
      const recorded = logs[0]?.args;
      if (!recorded?.submissionId) throw new Error("Submission was recorded but its ID could not be read.");
      if (!criteria) throw new Error("Acceptance criteria are unavailable.");
      setStage("genlayer");
      await verifySubmission({
        address,
        jobId,
        submissionId: recorded.submissionId,
        deliverableUrl: url,
        criteria,
        attempt: Number(recorded.attempt)
      });
    } catch (error) {
      setStage("idle");
      setUrlError(error instanceof Error
        ? `${error.message} Your Arbitrum submission is saved. Use Complete GenLayer Review on the job page to retry.`
        : "GenLayer review could not start. Your Arbitrum submission is saved.");
      return;
    }

    onSubmitted?.();
    onClose();
    setTimeout(() => location.reload(), 1500);
  }

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
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        onSubmit={submit}
        className="panel grid gap-5 p-6"
        style={{ width: "100%", maxWidth: 520 }}
      >
        <div>
          <h2 className="text-xl font-bold">{retry ? "Resubmit deliverable" : "Submit deliverable"}</h2>
          <p className="text-sm mt-2 text-muted">
            Paste a public URL to your work. GenLayer validators will fetch it and check it against the acceptance criteria.
          </p>
        </div>

        {!domainSupported && (
          <div style={{ background: "var(--warn-soft)", border: "1px solid #FDE68A", borderRadius: 10, padding: 12, fontSize: 13, color: "#92400E" }}>
            ⚠ This job domain ({domain}) may not be supported by GenLayer for verification. Consider reaching for a {SUPPORTED_DOMAINS.slice(0, -1).join(", ")}, or {SUPPORTED_DOMAINS.slice(-1)} job instead.
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
            type="url"
          />
        </div>

        {verifiableMessage && (
          <div style={{ background: "var(--warn-soft)", border: "1px solid #FDE68A", borderRadius: 10, padding: 12, fontSize: 13, color: "#92400E" }}>
            ⚠ {verifiableMessage}
          </div>
        )}

        {urlError && (
          <p className="text-xs" style={{ color: "var(--danger)" }}>{urlError}</p>
        )}

        <div className="flex gap-2 justify-end">
          <button type="button" className="btn ghost" onClick={onClose} disabled={isPending || checkingUrl}>Cancel</button>
          <button className="btn" disabled={isPending || checkingUrl || stage !== "idle" || !url}>
            {stage === "arbitrum" ? "Recording submission…" : stage === "genlayer" ? "Sign GenLayer review…" : retry ? "Resubmit" : "Submit & verify"}
          </button>
        </div>
      </form>
    </div>
  );
}
