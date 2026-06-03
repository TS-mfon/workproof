"use client";

import { useState } from "react";
import { useReadContract, useWriteContract } from "wagmi";
import { workProofAbi, workProofAddress } from "@/lib/contracts";
import { useTx } from "@/components/shared/TxToast";
import { AddressDisplay } from "@/components/shared/AddressDisplay";
import { Mono } from "@/components/shared/Mono";

export function OracleAdminPanel() {
  const { writeContractAsync, isPending } = useWriteContract();
  const { run } = useTx();
  const [newOracle, setNewOracle] = useState("");
  const [removeAddr, setRemoveAddr] = useState("");

  const { data: owner } = useReadContract({
    address: workProofAddress,
    abi: workProofAbi,
    functionName: "owner",
    query: { enabled: !!workProofAddress }
  });

  async function add() {
    const addr = workProofAddress;
    if (!addr || !newOracle.startsWith("0x")) return;
    await run({
      label: "Adding oracle",
      success: "Oracle added",
      write: () => writeContractAsync({ address: addr, abi: workProofAbi, functionName: "addOracle", args: [newOracle as `0x${string}`] })
    });
    setNewOracle("");
  }

  async function remove() {
    const addr = workProofAddress;
    if (!addr || !removeAddr.startsWith("0x")) return;
    await run({
      label: "Removing oracle",
      success: "Oracle removed",
      write: () => writeContractAsync({ address: addr, abi: workProofAbi, functionName: "removeOracle", args: [removeAddr as `0x${string}`] })
    });
    setRemoveAddr("");
  }

  return (
    <div className="panel p-6 grid gap-4">
      <h2 className="text-lg font-bold">Authorised oracles (on-chain)</h2>
      <p className="text-xs" style={{ color: "var(--muted)" }}>The contract uses a set of oracles. Add or remove their relaying wallets here.</p>
      <div>
        <div className="text-xs uppercase tracking-wide font-bold mb-1" style={{ color: "var(--muted)" }}>Contract owner</div>
        <Mono>{owner ? <AddressDisplay address={String(owner)} /> : "—"}</Mono>
      </div>

      <div className="grid gap-2">
        <label className="text-xs uppercase tracking-wide font-bold" style={{ color: "var(--muted)" }}>Add oracle wallet</label>
        <div className="flex gap-2">
          <input className="input" value={newOracle} onChange={(e) => setNewOracle(e.target.value)} placeholder="0x…" />
          <button className="btn" disabled={isPending || !newOracle.startsWith("0x")} onClick={add}>Add</button>
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-xs uppercase tracking-wide font-bold" style={{ color: "var(--muted)" }}>Remove oracle wallet</label>
        <div className="flex gap-2">
          <input className="input" value={removeAddr} onChange={(e) => setRemoveAddr(e.target.value)} placeholder="0x…" />
          <button className="btn danger" disabled={isPending || !removeAddr.startsWith("0x")} onClick={remove}>Remove</button>
        </div>
      </div>
    </div>
  );
}
