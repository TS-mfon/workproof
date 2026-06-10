"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { workProofAbi, workProofAddress } from "@/lib/contracts";
import { useTx } from "@/components/shared/TxToast";
import { AddressDisplay } from "@/components/shared/AddressDisplay";
import { Skeleton } from "@/components/shared/Skeleton";
import type { Job } from "@/lib/types";

export function ApplicantsPanel({ job }: { job: Job }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const { run } = useTx();
  const isClient = address && address.toLowerCase() === job.client_wallet.toLowerCase();

  const { data: applicants, isLoading, refetch } = useReadContract({
    address: workProofAddress,
    abi: workProofAbi,
    functionName: "getApplicants",
    args: [job.job_id_onchain as `0x${string}`],
    query: { enabled: !!workProofAddress && job.status === "Open" }
  });

  const [acceptingFor, setAcceptingFor] = useState<string | null>(null);

  if (!isClient || job.status !== "Open") return null;

  async function accept(freelancer: string) {
    const addr = workProofAddress;
    if (!addr) return;
    setAcceptingFor(freelancer);
    const args = [job.job_id_onchain as `0x${string}`, freelancer as `0x${string}`] as const;
    const hash = await run({
      label: `Accepting ${freelancer.slice(0, 6)}…`,
      pending: "Locking the assignment on Arbitrum…",
      success: "Freelancer assigned",
      simulate: () => publicClient!.simulateContract({
        address: addr, abi: workProofAbi, functionName: "acceptApplication", args, account: address
      }),
      write: () => writeContractAsync({
        address: addr,
        abi: workProofAbi,
        functionName: "acceptApplication",
        args
      })
    });
    setAcceptingFor(null);
    if (hash) {
      setTimeout(() => { location.reload(); }, 1500);
      refetch();
    }
  }

  return (
    <div className="panel p-6 grid gap-3">
      <div>
        <h2 className="text-lg font-bold">Applicants</h2>
        <p className="text-xs text-muted mt-1">Pick one freelancer to start the job. Their wallet is locked into escrow on accept.</p>
      </div>
      {isLoading ? (
        <Skeleton height={48} />
      ) : !applicants || (applicants as readonly string[]).length === 0 ? (
        <div className="empty-state" style={{ padding: 18 }}>No applicants yet — share this job to attract freelancers.</div>
      ) : (
        <div className="grid gap-2">
          {(applicants as readonly string[]).map((wallet) => (
            <div key={wallet} className="flex items-center justify-between gap-3 rounded-lg border" style={{ borderColor: "var(--line)", padding: "10px 12px", background: "var(--surface-soft)" }}>
              <span className="mono text-sm" style={{ color: "var(--muted-strong)" }}>
                <AddressDisplay address={wallet} />
              </span>
              <button
                className="btn tiny"
                disabled={isPending || acceptingFor === wallet}
                onClick={() => accept(wallet)}
              >
                {acceptingFor === wallet ? "Accepting…" : "Accept"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
