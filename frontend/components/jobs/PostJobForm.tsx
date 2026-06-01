"use client";

import { FormEvent, useState } from "react";
import { parseEther, parseEventLogs, zeroAddress } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { workProofAbi, workProofAddress } from "@/lib/contracts";

export function PostJobForm() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!address || !workProofAddress || !publicClient) {
      setMessage("Connect wallet and configure contract address.");
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

    const hash = await writeContractAsync({
      address: workProofAddress,
      abi: workProofAbi,
      functionName: "postJob",
      args: [title, specHash, criteria, domain, deadline, assigned || zeroAddress],
      value: parseEther(reward)
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const logs = parseEventLogs({ abi: workProofAbi, eventName: "JobPosted", logs: receipt.logs });
    const jobId = logs[0]?.args.jobId;
    if (!jobId) throw new Error("JobPosted event missing");

    const response = await fetch("/api/jobs", {
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
    });
    if (!response.ok) throw new Error(await response.text());
    location.href = `/jobs/${jobId}`;
  }

  return (
    <form className="panel grid gap-4 p-5" onSubmit={submit}>
      <input className="input" name="title" placeholder="Title" required />
      <textarea className="textarea" name="description" placeholder="Description" required />
      <textarea className="textarea" name="criteria" placeholder="Acceptance criteria for GenLayer" required />
      <select className="select" name="domain" required>
        <option value="smart-contracts">Smart Contracts</option>
        <option value="frontend">Frontend</option>
        <option value="design">Design</option>
        <option value="content">Content</option>
        <option value="marketing">Marketing</option>
      </select>
      <input className="input" name="reward" type="number" step="0.0001" min="0" placeholder="Reward amount in ETH" required />
      <input className="input" name="deadline" type="datetime-local" required />
      <input className="input" name="assigned" placeholder="Assign to wallet, optional" />
      <input className="input" name="spec" placeholder="IPFS spec hash, optional" />
      <button className="btn" disabled={isPending}>{isPending ? "Posting..." : "Post Job and Lock ETH"}</button>
      {message && <p className="text-sm text-red-700">{message}</p>}
    </form>
  );
}
