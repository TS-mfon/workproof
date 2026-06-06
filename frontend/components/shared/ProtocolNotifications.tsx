"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useAccount, usePublicClient } from "wagmi";
import { workProofAbi, workProofAddress } from "@/lib/contracts";

type Notice = { jobId: string; score: string; tx: string };

export function ProtocolNotifications() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    if (!address || !publicClient || !workProofAddress) { setNotices([]); return; }
    const contractAddress = workProofAddress;
    let alive = true;
    (async () => {
      const latest = await publicClient.getBlockNumber();
      const logs = await publicClient.getContractEvents({
        address: contractAddress,
        abi: workProofAbi,
        eventName: "ClientApproved",
        args: { freelancer: address },
        fromBlock: latest > 250000n ? latest - 250000n : 0n,
        toBlock: "latest"
      });
      if (alive) setNotices(logs.reverse().slice(0, 8).map((log) => ({
        jobId: log.args.jobId ?? "",
        score: String(log.args.qualityScore ?? ""),
        tx: log.transactionHash
      })));
    })().catch(() => {});
    return () => { alive = false; };
  }, [address, publicClient]);

  if (!address) return null;
  return (
    <div style={{ position: "relative" }}>
      <button className="btn ghost tiny" aria-label="Notifications" onClick={() => setOpen((value) => !value)} style={{ position: "relative" }}>
        <Bell size={17} />
        {notices.length > 0 && <span style={{ position: "absolute", right: 3, top: 2, width: 7, height: 7, borderRadius: 99, background: "var(--success)" }} />}
      </button>
      {open && <div className="panel p-3 grid gap-2" style={{ position: "absolute", right: 0, top: 42, width: 310, zIndex: 40 }}>
        <strong className="text-sm">Protocol notifications</strong>
        {notices.length === 0 ? <p className="text-xs text-muted">No client approvals yet.</p> : notices.map((notice) => (
          <Link key={notice.tx} href={`/jobs/${notice.jobId}`} className="rounded-lg border p-3" style={{ borderColor: "var(--line)" }} onClick={() => setOpen(false)}>
            <div className="text-sm font-bold">Work accepted by client</div>
            <div className="text-xs text-muted mt-1">Score {notice.score}/100. Reward is ready to claim.</div>
          </Link>
        ))}
      </div>}
    </div>
  );
}
