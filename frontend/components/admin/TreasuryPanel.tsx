"use client";

import { useState } from "react";
import { formatEther } from "viem";
import { useBalance, useReadContract, useWriteContract } from "wagmi";
import { workProofAbi, workProofAddress } from "@/lib/contracts";
import { useTx } from "@/components/shared/TxToast";

export function TreasuryPanel() {
  const { writeContractAsync, isPending } = useWriteContract();
  const { run } = useTx();
  const [dest, setDest] = useState("");

  const balance = useBalance({ address: workProofAddress, query: { enabled: !!workProofAddress } });
  const { data: totalEscrowed, refetch } = useReadContract({
    address: workProofAddress,
    abi: workProofAbi,
    functionName: "totalEscrowed",
    query: { enabled: !!workProofAddress }
  });

  const balanceWei = balance.data?.value ?? 0n;
  const escrowed = totalEscrowed ? BigInt(totalEscrowed as bigint) : 0n;
  const stuck = balanceWei > escrowed ? balanceWei - escrowed : 0n;

  async function sweep() {
    const addr = workProofAddress;
    if (!addr || !dest.startsWith("0x")) return;
    await run({
      label: "Sweeping stuck ETH",
      success: "Sweep complete",
      write: () => writeContractAsync({ address: addr, abi: workProofAbi, functionName: "sweepStuckEth", args: [dest as `0x${string}`] }),
      onConfirmed: () => { refetch(); balance.refetch(); }
    });
    setDest("");
  }

  return (
    <div className="grid gap-6">
      <div className="grid-auto">
        <div className="metric-card">
          <p>Contract balance</p>
          <b>{formatEther(balanceWei)} ETH</b>
        </div>
        <div className="metric-card">
          <p>Total active escrow</p>
          <b>{formatEther(escrowed)} ETH</b>
        </div>
        <div className="metric-card" style={{ borderColor: stuck > 0n ? "var(--warn-soft)" : undefined }}>
          <p>Sweep-eligible</p>
          <b style={{ color: stuck > 0n ? "var(--warn)" : undefined }}>{formatEther(stuck)} ETH</b>
        </div>
      </div>

      <div className="panel p-6 grid gap-3">
        <h2 className="text-lg font-bold">Sweep stuck ETH</h2>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Sweeps only ETH not currently escrowed by an active job. The active escrow total is enforced on-chain so user funds are never at risk.
        </p>
        <div className="flex gap-2">
          <input className="input" placeholder="Destination wallet 0x…" value={dest} onChange={(e) => setDest(e.target.value)} />
          <button className="btn" disabled={isPending || stuck === 0n || !dest.startsWith("0x")} onClick={sweep}>Sweep</button>
        </div>
      </div>
    </div>
  );
}
