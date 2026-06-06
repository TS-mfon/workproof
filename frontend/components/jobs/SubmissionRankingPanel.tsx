"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { arbitrumSepolia } from "viem/chains";
import { workProofAbi, workProofAddress } from "@/lib/contracts";
import { readSubmissionVerdict, verifySubmission } from "@/lib/genlayer";
import { useTx } from "@/components/shared/TxToast";
import { AddressDisplay } from "@/components/shared/AddressDisplay";
import type { Job } from "@/lib/types";

type Submission = {
  submissionId: `0x${string}`;
  freelancer: `0x${string}`;
  deliverableUrl: string;
  attempt: bigint;
  status: number;
  qualityScore: bigint;
  reasoning: string;
};

type Verdict = Record<string, unknown> & {
  ready?: boolean;
  meets_criteria?: boolean;
  quality_score?: number | string;
  summary?: string;
  issues?: string;
};

export function SubmissionRankingPanel({ job }: { job: Job }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();
  const { run } = useTx();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState("");

  const isClient = address?.toLowerCase() === job.client_wallet.toLowerCase();
  const deadlinePassed = Date.now() > Date.parse(job.deadline);

  async function refresh() {
    if (!publicClient || !workProofAddress) return;
    const contractAddress = workProofAddress;
    const ids = await publicClient.readContract({
      address: contractAddress,
      abi: workProofAbi,
      functionName: "getJobSubmissions",
      args: [job.job_id_onchain as `0x${string}`]
    });
    const records = await publicClient.multicall({
      allowFailure: true,
      contracts: ids.map((id) => ({ address: contractAddress, abi: workProofAbi, functionName: "getSubmission", args: [id] }))
    });
    const next = records.flatMap((record) => record.status === "success" ? [record.result as unknown as Submission] : []);
    setSubmissions(next);
    const results = await Promise.all(next.map(async (submission) => {
      try { return [submission.submissionId, await readSubmissionVerdict(submission.submissionId)] as const; }
      catch { return [submission.submissionId, { ready: false }] as const; }
    }));
    setVerdicts(Object.fromEntries(results));
  }

  useEffect(() => { refresh().catch(() => {}); }, [job.job_id_onchain, publicClient]);

  const ranked = useMemo(() => [...submissions].sort((a, b) => {
    const av = verdicts[a.submissionId];
    const bv = verdicts[b.submissionId];
    const ap = av?.meets_criteria ? Number(av.quality_score ?? 0) : -1;
    const bp = bv?.meets_criteria ? Number(bv.quality_score ?? 0) : -1;
    return bp - ap;
  }), [submissions, verdicts]);

  async function completeReview(submission: Submission) {
    if (!address) return;
    setBusy(submission.submissionId);
    setError("");
    try {
      await verifySubmission({
        address,
        jobId: job.job_id_onchain,
        submissionId: submission.submissionId,
        deliverableUrl: submission.deliverableUrl,
        criteria: job.acceptance_criteria,
        attempt: Number(submission.attempt)
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "GenLayer review failed.");
    } finally {
      setBusy("");
    }
  }

  async function approve(submission: Submission, verdict: Verdict) {
    if (!workProofAddress) return;
    const contractAddress = workProofAddress;
    await switchChainAsync({ chainId: arbitrumSepolia.id });
    const score = Math.max(0, Math.min(100, Number(verdict.quality_score ?? 0)));
    const hash = await run({
      label: "Approving submission",
      pending: "Recording client approval on Arbitrum…",
      success: "Work accepted. Reward is claimable.",
      write: () => writeContractAsync({
        address: contractAddress,
        abi: workProofAbi,
        functionName: "approveSubmission",
        args: [job.job_id_onchain as `0x${string}`, submission.submissionId, score, String(verdict.summary ?? "Client approved GenLayer recommendation")]
      })
    });
    if (hash) setTimeout(() => location.reload(), 1000);
  }

  if (submissions.length === 0) return null;

  return (
    <div className="panel p-6 grid gap-4">
      <div>
        <h2 className="text-lg font-bold">{job.mode === "Competitive" ? "Submission ranking" : "Submitted work"}</h2>
        <p className="text-xs text-muted mt-1">
          Verdicts are read directly from GenLayer StudioNet. Only passing submissions are eligible for client approval.
        </p>
      </div>
      {ranked.map((submission, index) => {
        const verdict = verdicts[submission.submissionId] ?? {};
        const own = address?.toLowerCase() === submission.freelancer.toLowerCase();
        const canApprove = isClient && verdict.meets_criteria && index === 0 && (job.mode !== "Competitive" || deadlinePassed);
        return (
          <div key={submission.submissionId} className="rounded-lg border p-4 grid gap-3" style={{ borderColor: index === 0 && verdict.meets_criteria ? "var(--success)" : "var(--line)" }}>
            <div className="flex justify-between gap-3 flex-wrap">
              <strong>#{index + 1} <AddressDisplay address={submission.freelancer} /></strong>
              <span className="status-badge" data-state={verdict.ready ? verdict.meets_criteria ? "passed" : "failed" : "under-review"}>
                <span className="dot" /> {verdict.ready ? verdict.meets_criteria ? `${verdict.quality_score}/100 Passed` : "Failed" : "Review required"}
              </span>
            </div>
            <a href={submission.deliverableUrl} target="_blank" rel="noreferrer" className="mono text-xs break-all" style={{ color: "var(--accent)" }}>{submission.deliverableUrl}</a>
            {verdict.summary && <p className="text-sm">{String(verdict.summary)}</p>}
            {verdict.issues && <p className="text-xs" style={{ color: "var(--danger)" }}>{String(verdict.issues)}</p>}
            <div className="flex gap-2 flex-wrap">
              {own && !verdict.ready && <button className="btn tiny" disabled={busy === submission.submissionId} onClick={() => completeReview(submission)}>
                {busy === submission.submissionId ? "Verifying…" : "Complete GenLayer review"}
              </button>}
              {canApprove && <button className="btn success tiny" disabled={isPending} onClick={() => approve(submission, verdict)}>
                Approve winner
              </button>}
              {isClient && job.mode === "Competitive" && !deadlinePassed && verdict.meets_criteria && <span className="text-xs text-muted">Approval unlocks after deadline.</span>}
            </div>
          </div>
        );
      })}
      {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
