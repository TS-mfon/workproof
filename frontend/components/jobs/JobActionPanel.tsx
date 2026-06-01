"use client";

import { FormEvent, useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { workProofAbi, workProofAddress } from "@/lib/contracts";
import type { Job } from "@/lib/types";

export function JobActionPanel({ job }: { job: Job }) {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const [message, setMessage] = useState("");
  const wallet = address?.toLowerCase();
  const isClient = wallet === job.client_wallet.toLowerCase();
  const isFreelancer = wallet === (job.freelancer_wallet || job.assigned_to_wallet || "").toLowerCase();

  async function call(functionName: "applyForJob" | "cancelJob" | "claimReward") {
    if (!workProofAddress) return setMessage("Contract address is not configured.");
    const hash = await writeContractAsync({ address: workProofAddress, abi: workProofAbi, functionName, args: [job.job_id_onchain as `0x${string}`] });
    setMessage(`Transaction submitted: ${hash}`);
  }

  async function submitWork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workProofAddress) return setMessage("Contract address is not configured.");
    const form = new FormData(event.currentTarget);
    const deliverableUrl = String(form.get("deliverableUrl") || "");
    const hash = await writeContractAsync({
      address: workProofAddress,
      abi: workProofAbi,
      functionName: "submitWork",
      args: [job.job_id_onchain as `0x${string}`, deliverableUrl]
    });
    setMessage(`Submitted for AI review: ${hash}`);
  }

  return (
    <div className="panel grid gap-3 p-5">
      <h2 className="text-xl font-bold">Actions</h2>
      {!address && <p className="text-sm text-slate-600">Connect a wallet to see available actions.</p>}
      {address && job.status === "Open" && !isClient && <button className="btn" disabled={isPending} onClick={() => call("applyForJob")}>Apply for Job</button>}
      {address && job.status === "Open" && isClient && <button className="btn danger" disabled={isPending} onClick={() => call("cancelJob")}>Cancel Job</button>}
      {address && isFreelancer && (job.status === "Active" || job.status === "Failed") && (
        <form className="grid gap-2" onSubmit={submitWork}>
          <input className="input" name="deliverableUrl" placeholder="Deliverable URL" required />
          <button className="btn" disabled={isPending}>Submit Work</button>
        </form>
      )}
      {address && isFreelancer && job.status === "Passed" && <a className="btn" href="/claim">Go to Claim Page</a>}
      {message && <p className="text-sm text-slate-700">{message}</p>}
    </div>
  );
}
