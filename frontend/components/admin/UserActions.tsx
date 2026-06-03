"use client";

import { useState } from "react";
import { useReadContract, useWriteContract } from "wagmi";
import { workProofAbi, workProofAddress } from "@/lib/contracts";
import { useTx } from "@/components/shared/TxToast";

export function UserActions({ wallet }: { wallet: string }) {
  const { writeContractAsync, isPending } = useWriteContract();
  const { run } = useTx();
  const [openBan, setOpenBan] = useState(false);
  const [openRep, setOpenRep] = useState(false);

  const { data: banned, refetch } = useReadContract({
    address: workProofAddress,
    abi: workProofAbi,
    functionName: "bannedWallets",
    args: [wallet as `0x${string}`],
    query: { enabled: !!workProofAddress }
  });

  async function unban() {
    const addr = workProofAddress;
    if (!addr) return;
    await run({
      label: "Unbanning wallet",
      success: "Wallet unbanned",
      write: () => writeContractAsync({ address: addr, abi: workProofAbi, functionName: "unbanUser", args: [wallet as `0x${string}`] }),
      onConfirmed: () => { refetch(); }
    });
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {banned ? (
        <>
          <span className="status-badge" data-state="deleted"><span className="dot" /> Banned</span>
          <button className="btn ghost tiny" disabled={isPending} onClick={unban}>Unban</button>
        </>
      ) : (
        <button className="btn danger tiny" disabled={isPending} onClick={() => setOpenBan(true)}>Ban</button>
      )}
      <button className="btn ghost tiny" disabled={isPending} onClick={() => setOpenRep(true)}>Adjust Rep</button>

      {openBan && (
        <ModalShell onClose={() => setOpenBan(false)}>
          <BanForm wallet={wallet} onClose={() => setOpenBan(false)} onDone={() => refetch()} />
        </ModalShell>
      )}
      {openRep && (
        <ModalShell onClose={() => setOpenRep(false)}>
          <RepForm wallet={wallet} onClose={() => setOpenRep(false)} />
        </ModalShell>
      )}
    </div>
  );
}

function BanForm({ wallet, onClose, onDone }: { wallet: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { writeContractAsync } = useWriteContract();
  const { run } = useTx();

  async function submit() {
    const addr = workProofAddress;
    if (!addr) return;
    setSubmitting(true);
    await run({
      label: "Banning wallet",
      success: "Wallet banned",
      write: () => writeContractAsync({ address: addr, abi: workProofAbi, functionName: "banUser", args: [wallet as `0x${string}`, reason] }),
      onConfirmed: () => { onDone(); }
    });
    setSubmitting(false);
    onClose();
  }

  return (
    <>
      <h2 className="text-lg font-bold">Ban wallet</h2>
      <p className="text-xs mt-1 mono break-all" style={{ color: "var(--muted)" }}>{wallet}</p>
      <input className="input" autoFocus placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex gap-2 justify-end">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn danger" disabled={submitting || reason.length < 3} onClick={submit}>{submitting ? "Banning…" : "Ban"}</button>
      </div>
    </>
  );
}

function RepForm({ wallet, onClose }: { wallet: string; onClose: () => void }) {
  const [points, setPoints] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { writeContractAsync } = useWriteContract();
  const { run } = useTx();

  async function submit() {
    const addr = workProofAddress;
    if (!addr) return;
    setSubmitting(true);
    await run({
      label: "Adjusting reputation",
      success: "Reputation updated",
      write: () => writeContractAsync({ address: addr, abi: workProofAbi, functionName: "setReputation", args: [wallet as `0x${string}`, BigInt(points), reason] })
    });
    setSubmitting(false);
    onClose();
    setTimeout(() => location.reload(), 1500);
  }

  return (
    <>
      <h2 className="text-lg font-bold">Adjust reputation</h2>
      <p className="text-xs mt-1 mono break-all" style={{ color: "var(--muted)" }}>{wallet}</p>
      <div className="grid gap-1">
        <label className="text-xs font-bold uppercase tracking-wide text-muted">New rep points</label>
        <input className="input" type="number" value={points} onChange={(e) => setPoints(Number(e.target.value))} min={0} />
      </div>
      <input className="input" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex gap-2 justify-end">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn" disabled={submitting || reason.length < 3} onClick={submit}>{submitting ? "Saving…" : "Save"}</button>
      </div>
    </>
  );
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(7,7,11,0.65)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="panel p-6 grid gap-4" style={{ width: "100%", maxWidth: 480 }}>
        {children}
      </div>
    </div>
  );
}
