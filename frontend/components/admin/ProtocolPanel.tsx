"use client";

import { useState } from "react";
import { useReadContract, useWriteContract } from "wagmi";
import { workProofAbi, workProofAddress } from "@/lib/contracts";
import { useTx } from "@/components/shared/TxToast";

export function ProtocolPanel() {
  const { writeContractAsync, isPending } = useWriteContract();
  const { run } = useTx();

  const { data: paused, refetch: refetchPaused } = useReadContract({
    address: workProofAddress,
    abi: workProofAbi,
    functionName: "globalPaused",
    query: { enabled: !!workProofAddress }
  });
  const { data: window, refetch: refetchWindow } = useReadContract({
    address: workProofAddress,
    abi: workProofAbi,
    functionName: "disputeWindow",
    query: { enabled: !!workProofAddress }
  });

  const [windowHours, setWindowHours] = useState<number>(0);

  async function togglePaused() {
    const addr = workProofAddress;
    if (!addr) return;
    await run({
      label: paused ? "Resuming protocol" : "Pausing protocol",
      success: paused ? "Protocol resumed" : "Protocol paused",
      write: () => writeContractAsync({ address: addr, abi: workProofAbi, functionName: "setGlobalPaused", args: [!paused] }),
      onConfirmed: () => { refetchPaused(); }
    });
  }

  async function saveWindow() {
    const addr = workProofAddress;
    if (!addr) return;
    const seconds = BigInt(Math.round(windowHours * 3600));
    await run({
      label: "Updating dispute window",
      success: "Dispute window updated",
      write: () => writeContractAsync({ address: addr, abi: workProofAbi, functionName: "setDisputeWindow", args: [seconds] }),
      onConfirmed: () => { refetchWindow(); }
    });
  }

  const currentSeconds = window ? Number(window as bigint) : 0;
  const currentHours = (currentSeconds / 3600).toFixed(2);

  return (
    <div className="grid gap-6">
      <div className="panel p-6 grid gap-3">
        <h2 className="text-lg font-bold">Global pause</h2>
        <p className="text-xs" style={{ color: "var(--muted)" }}>Freezes every state-changing call across the protocol. Use as a circuit breaker.</p>
        <div className="flex items-center gap-3">
          <span className="status-badge" data-state={paused ? "deleted" : "complete"}>
            <span className="dot" /> {paused ? "Paused" : "Operational"}
          </span>
          <button className={`btn ${paused ? "" : "danger"}`} disabled={isPending} onClick={togglePaused}>
            {paused ? "Resume protocol" : "Pause protocol"}
          </button>
        </div>
      </div>

      <div className="panel p-6 grid gap-3">
        <h2 className="text-lg font-bold">Dispute window</h2>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Adds a cooling-off period between a Passed verdict and the freelancer's claim, so clients can open a dispute first. Max 7 days.
        </p>
        <div>
          <div className="text-xs uppercase tracking-wide font-bold" style={{ color: "var(--muted)" }}>Current</div>
          <div className="text-2xl font-black mt-1">{currentHours}h</div>
        </div>
        <div className="flex gap-2 items-end">
          <div className="grid gap-1 flex-1">
            <label className="text-xs uppercase tracking-wide font-bold" style={{ color: "var(--muted)" }}>New window (hours, 0 = no delay)</label>
            <input className="input" type="number" min={0} max={168} step={0.5} value={windowHours} onChange={(e) => setWindowHours(Number(e.target.value))} />
          </div>
          <button className="btn" disabled={isPending} onClick={saveWindow}>Save</button>
        </div>
      </div>
    </div>
  );
}
