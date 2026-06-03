"use client";

import { FormEvent, useState } from "react";
import { parseEther, parseEventLogs, zeroAddress } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { workProofAbi, workProofAddress } from "@/lib/contracts";
import { useTx } from "@/components/shared/TxToast";

export function PostJobForm() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const { run } = useTx();
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const addr = workProofAddress;
    if (!address || !addr || !publicClient) {
      setError("Connect a wallet to post a job.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "");
    const description = String(form.get("description") || "");
    const criteria = String(form.get("criteria") || "");
    const domain = String(form.get("domain") || "frontend");
    const reward = String(form.get("reward") || "0");
    const deadlineIso = String(form.get("deadline") || "");
    const assigned = String(form.get("assigned") || "") as `0x${string}`;
    const specHash = String(form.get("spec") || "");
    const deadline = BigInt(Math.floor(new Date(deadlineIso).getTime() / 1000));

    const hash = await run({
      label: "Posting job",
      pending: "Locking escrow on Arbitrum…",
      success: "Job posted",
      write: () =>
        writeContractAsync({
          address: addr,
          abi: workProofAbi,
          functionName: "postJob",
          args: [title, specHash, criteria, domain, deadline, assigned || zeroAddress],
          value: parseEther(reward)
        })
    });
    if (!hash) return;

    try {
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const logs = parseEventLogs({ abi: workProofAbi, eventName: "JobPosted", logs: receipt.logs });
      const jobId = logs[0]?.args.jobId;
      if (!jobId) throw new Error("Could not find on-chain job id.");

      await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          job_id_onchain: jobId,
          client_wallet: address,
          assigned_to_wallet: assigned || null,
          title,
          description,
          spec_ipfs_hash: specHash || null,
          acceptance_criteria: criteria,
          domain,
          escrow_amount_wei: parseEther(reward).toString(),
          reward_amount_wei: parseEther(reward).toString(),
          status: assigned ? "Active" : "Open",
          deadline: new Date(Number(deadline) * 1000).toISOString(),
          tx_hash: hash
        })
      }).catch(() => {});
      location.href = `/jobs/${jobId}`;
    } catch (err: any) {
      setError(err?.message || "Could not finalize job indexing — the on-chain post is still recorded.");
    }
  }

  return (
    <form className="panel grid gap-4 p-6" onSubmit={submit}>
      <div className="grid gap-1">
        <label className="text-xs font-bold uppercase tracking-wide text-muted">Job title</label>
        <input className="input" name="title" placeholder="e.g. Build a responsive landing page" required />
      </div>
      <div className="grid gap-1">
        <label className="text-xs font-bold uppercase tracking-wide text-muted">Project brief</label>
        <textarea className="textarea" name="description" placeholder="Describe the work, the audience, and the deliverable format." required />
      </div>
      <div className="grid gap-1">
        <label className="text-xs font-bold uppercase tracking-wide text-muted">Acceptance criteria (read by the AI verifier)</label>
        <textarea className="textarea" name="criteria" placeholder="Bullet the must-haves the AI should check for: structure, sections, length, links, tone." required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1">
          <label className="text-xs font-bold uppercase tracking-wide text-muted">Domain</label>
          <select className="select" name="domain" required defaultValue="frontend">
            <option value="smart-contracts">Smart Contracts</option>
            <option value="frontend">Frontend</option>
            <option value="design">Design</option>
            <option value="content">Content</option>
            <option value="marketing">Marketing</option>
            <option value="research">Research</option>
          </select>
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-bold uppercase tracking-wide text-muted">Reward (ETH)</label>
          <input className="input" name="reward" type="number" step="0.0001" min="0" placeholder="0.01" required />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1">
          <label className="text-xs font-bold uppercase tracking-wide text-muted">Deadline</label>
          <input className="input" name="deadline" type="datetime-local" required />
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-bold uppercase tracking-wide text-muted">Pre-assigned freelancer (optional)</label>
          <input className="input" name="assigned" placeholder="0x… leave empty to open applications" />
        </div>
      </div>
      <input type="hidden" name="spec" value="" />
      <button className="btn" disabled={isPending}>{isPending ? "Posting…" : "Post Job and Lock ETH"}</button>
      {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
    </form>
  );
}
