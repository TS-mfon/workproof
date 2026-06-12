"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { arbitrumSepolia } from "viem/chains";
import { workProofAbi, workProofAddress } from "@/lib/contracts";
import { useTx } from "@/components/shared/TxToast";
import { SubmitDeliverableModal } from "@/components/jobs/SubmitDeliverableModal";
import type { Job } from "@/lib/types";
import { useWalletSession } from "@/lib/wallet-session-client";

export function JobActionPanel({ job }: { job: Job }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const { run } = useTx();
  const router = useRouter();
  const [openSubmit, setOpenSubmit] = useState(false);
  const [openDispute, setOpenDispute] = useState(false);
  const [hasUnresolvedCompetitive, setHasUnresolvedCompetitive] = useState(false);

  const wallet = address?.toLowerCase();
  const isClient = wallet === job.client_wallet.toLowerCase();
  const isFreelancer = wallet === (job.freelancer_wallet || job.assigned_to_wallet || "").toLowerCase();

  const { data: hasApplied } = useReadContract({
    address: workProofAddress,
    abi: workProofAbi,
    functionName: "hasApplied",
    args: address && job.job_id_onchain ? [job.job_id_onchain as `0x${string}`, address] : undefined,
    query: { enabled: !!workProofAddress && !!address && job.status === "Open" && !isClient }
  });

  const { data: banned } = useReadContract({
    address: workProofAddress,
    abi: workProofAbi,
    functionName: "bannedWallets",
    args: address ? [address] : undefined,
    query: { enabled: !!workProofAddress && !!address }
  });

  useEffect(() => {
    if (!publicClient || !workProofAddress || !address || job.mode !== "Competitive") return;
    let active = true;
    (async () => {
      const ids = await publicClient.readContract({
        address: workProofAddress,
        abi: workProofAbi,
        functionName: "getJobSubmissions",
        args: [job.job_id_onchain as `0x${string}`]
      });
      const records = await publicClient.multicall({
        allowFailure: true,
        contracts: ids.map((id) => ({ address: workProofAddress!, abi: workProofAbi, functionName: "getSubmission", args: [id] }))
      });
      const unresolved = records.some((record) => {
        if (record.status !== "success") return false;
        const submission = record.result as unknown as { freelancer: string; status: number };
        return submission.freelancer.toLowerCase() === address.toLowerCase() && submission.status === 0;
      });
      if (active) setHasUnresolvedCompetitive(unresolved);
    })().catch(() => {});
    return () => { active = false; };
  }, [address, job.job_id_onchain, job.mode, publicClient]);

  async function call(functionName: "applyForJob" | "cancelJob" | "claimReward", label: string) {
    const addr = workProofAddress;
    if (!addr || !address) return;
    const args = [job.job_id_onchain as `0x${string}`] as const;
    const hash = await run({
      label,
      pending: `${label}…`,
      success: `${label} confirmed`,
      simulate: () => publicClient!.simulateContract({ address: addr, abi: workProofAbi, functionName, args, account: address }),
      write: () => writeContractAsync({
        address: addr,
        abi: workProofAbi,
        functionName,
        args
      })
    });
    if (hash) setTimeout(() => router.refresh(), 1200);
  }

  if (!isConnected || !address) {
    return (
      <div className="panel p-6">
        <h2 className="text-lg font-bold">Take action</h2>
        <p className="text-sm mt-2 text-muted">Connect a wallet to apply, submit work, or claim a reward.</p>
      </div>
    );
  }

  if (chainId !== arbitrumSepolia.id) {
    return (
      <div className="panel p-6">
        <h2 className="text-lg font-bold">Wrong network</h2>
        <p className="text-sm mt-2 text-muted">Switch your wallet to Arbitrum Sepolia to interact with this job.</p>
      </div>
    );
  }

  if (banned) {
    return (
      <div className="panel p-6" style={{ borderColor: "var(--danger-soft)", background: "var(--danger-soft)" }}>
        <h2 className="text-lg font-bold" style={{ color: "var(--danger)" }}>Wallet restricted</h2>
        <p className="text-sm mt-2" style={{ color: "var(--danger)" }}>
          Your wallet is restricted by an admin and can't take actions in the protocol.
        </p>
      </div>
    );
  }

  return (
    <div className="panel p-6 grid gap-4">
      <h2 className="text-lg font-bold">Take action</h2>

      {job.status === "Open" && !isClient && hasApplied ? (
        <div>
          <span className="status-badge" data-state="open"><span className="dot" /> Application sent</span>
          <p className="text-xs mt-2 text-muted">Waiting for the client to accept. You'll be notified by status change.</p>
        </div>
      ) : null}

      {job.status === "Open" && job.mode !== "Competitive" && !isClient && !hasApplied && (
        <>
          <button className="btn" disabled={isPending} onClick={() => call("applyForJob", "Applying for job")}>
            Apply for this job
          </button>
          <p className="text-xs text-muted">You'll be added to the applicants list. The client picks one freelancer.</p>
        </>
      )}

      {job.status === "Open" && job.mode === "Competitive" && !isClient && (
        <>
          <button className="btn" disabled={isPending || hasUnresolvedCompetitive} onClick={() => setOpenSubmit(true)}>Submit competitive entry</button>
          <p className="text-xs text-muted">
            {hasUnresolvedCompetitive
              ? "Your current entry is still under review. You can submit again after it resolves."
              : "Up to three attempts. GenLayer ranks passing submissions and the client approves the highest score after the deadline."}
          </p>
        </>
      )}

      {job.status === "Open" && isClient && (
        <>
          <p className="text-sm text-muted">
            {job.mode === "Competitive"
              ? "Freelancers submit entries until the deadline. After it closes, approve the highest-ranked passing submission."
              : job.mode === "Direct"
                ? "This direct job is reserved for the assigned freelancer."
                : "Pick a freelancer from the applicants panel below to start the job."}
          </p>
          <button className="btn danger" disabled={isPending} onClick={() => call("cancelJob", "Cancelling job")}>
            Cancel job &amp; refund
          </button>
        </>
      )}

      {job.status === "Active" && isFreelancer && (
        <>
          <button className="btn" disabled={isPending} onClick={() => setOpenSubmit(true)}>
            Submit deliverable
          </button>
          <p className="text-xs text-muted">Once submitted, the AI verifier reads your work against the acceptance criteria.</p>
        </>
      )}

      {job.status === "Active" && isClient && (
        <p className="text-sm text-muted">Freelancer is working on it. You'll see the deliverable here as soon as they submit.</p>
      )}

      {job.status === "Active" && !isClient && !isFreelancer && (
        <p className="text-sm text-muted">A freelancer has been assigned. Browse other open jobs to find work.</p>
      )}

      {job.status === "UnderReview" && (
        <div>
          <span className="status-badge" data-state="under-review"><span className="dot" /> AI is reviewing</span>
          <p className="text-xs mt-2 text-muted">Verdict typically lands in 1–3 minutes. No action needed.</p>
        </div>
      )}

      {job.status === "UnderReview" && job.mode === "Competitive" && !isClient && (
        <button className="btn ghost" disabled={isPending || hasUnresolvedCompetitive} onClick={() => setOpenSubmit(true)}>
          {hasUnresolvedCompetitive ? "Current attempt under review" : "Submit another attempt"}
        </button>
      )}

      {job.status === "AwaitingApproval" && (
        <p className="text-sm text-muted">GenLayer review is complete. Waiting for the client to approve the submission before reward claim.</p>
      )}

      {job.status === "Failed" && isFreelancer && job.retry_count < 3 && (
        <>
          <button className="btn" disabled={isPending} onClick={() => setOpenSubmit(true)}>
            Resubmit ({3 - job.retry_count} attempt{3 - job.retry_count > 1 ? "s" : ""} left)
          </button>
          <button className="btn ghost tiny" onClick={() => setOpenDispute(true)}>
            Dispute verdict
          </button>
        </>
      )}

      {job.status === "Failed" && isClient && (
        <p className="text-sm text-muted">The AI rejected the submission. The freelancer can resubmit up to 3 attempts.</p>
      )}

      {job.status === "Passed" && isFreelancer && (
        <>
          <button className="btn success" disabled={isPending} onClick={() => call("claimReward", "Claiming reward")}>
            Claim reward
          </button>
          <p className="text-xs text-muted">Payout transfers to your wallet immediately.</p>
        </>
      )}

      {job.status === "Passed" && isClient && (
        <>
          <p className="text-sm text-muted">You accepted this work. The freelancer can now claim.</p>
          <button className="btn ghost tiny" onClick={() => setOpenDispute(true)}>
            Open dispute
          </button>
        </>
      )}

      {job.status === "Complete" && (
        <div><span className="status-badge" data-state="complete"><span className="dot" /> Complete</span></div>
      )}

      {job.status === "Refunded" && (
        <div><span className="status-badge" data-state="refunded"><span className="dot" /> Refunded to client</span></div>
      )}

      {job.status === "Deleted" && (
        <div><span className="status-badge" data-state="deleted"><span className="dot" /> Removed by admin</span></div>
      )}

      <SubmitDeliverableModal
        jobId={job.job_id_onchain}
        criteria={job.acceptance_criteria}
        domain={job.domain}
        open={openSubmit}
        onClose={() => setOpenSubmit(false)}
        retry={job.status === "Failed"}
      />

      {openDispute && (
        <DisputeModal
          jobId={job.job_id_onchain}
          opener={address}
          onClose={() => setOpenDispute(false)}
        />
      )}
    </div>
  );
}

function DisputeModal({ jobId, opener, onClose }: { jobId: string; opener: string; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const { ensureSession } = useWalletSession();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await ensureSession();
      const response = await fetch("/api/disputes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ job_id_onchain: jobId, opener_wallet: opener, reason })
      });
      if (!response.ok) throw new Error("Dispute submission failed");
      setDone(true);
      setTimeout(onClose, 1500);
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form onSubmit={submit} className="panel p-6 grid gap-4" style={{ width: "100%", maxWidth: 480 }}>
        <div>
          <h2 className="text-lg font-bold">Open a dispute</h2>
          <p className="text-xs mt-1 text-muted">An admin will manually review and can override the AI verdict.</p>
        </div>
        {done ? (
          <p className="text-sm" style={{ color: "var(--success)" }}>Dispute submitted. We'll notify you when it's resolved.</p>
        ) : (
          <>
            <textarea
              className="textarea"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why do you think the AI verdict is wrong? Be specific."
              required
            />
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
              <button className="btn" disabled={submitting || reason.length < 10}>
                {submitting ? "Submitting…" : "Open dispute"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
