"use client";

import { useState } from "react";
import { useWriteContract } from "wagmi";
import { workProofAbi, workProofAddress } from "@/lib/contracts";

export function AdminActions({ jobId }: { jobId: string }) {
  const { writeContractAsync, isPending } = useWriteContract();
  const [message, setMessage] = useState("");
  async function pause() {
    if (!workProofAddress) return setMessage("Contract address missing.");
    const hash = await writeContractAsync({ address: workProofAddress, abi: workProofAbi, functionName: "pauseJob", args: [jobId as `0x${string}`, true] });
    setMessage(`Pause submitted: ${hash}`);
  }
  async function forceRefund() {
    if (!workProofAddress) return setMessage("Contract address missing.");
    const hash = await writeContractAsync({ address: workProofAddress, abi: workProofAbi, functionName: "adminForceRefund", args: [jobId as `0x${string}`, "Admin forced refund"] });
    setMessage(`Refund submitted: ${hash}`);
  }
  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn secondary" disabled={isPending} onClick={pause}>Pause Job</button>
      <button className="btn danger" disabled={isPending} onClick={forceRefund}>Force Refund</button>
      {message && <span className="text-sm">{message}</span>}
    </div>
  );
}
