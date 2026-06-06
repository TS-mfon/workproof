"use client";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

export const genLayerContract = (process.env.NEXT_PUBLIC_GENLAYER_CONTRACT ?? "") as `0x${string}`;

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
};

function provider() {
  return (window as typeof window & { ethereum?: EthereumProvider }).ethereum;
}

export function genLayerReadClient() {
  return createClient({ chain: studionet });
}

export function genLayerWriteClient(address: `0x${string}`) {
  const walletProvider = provider();
  if (!walletProvider) throw new Error("A browser wallet is required to sign the GenLayer review.");
  return createClient({ chain: studionet, account: address, provider: walletProvider });
}

export async function verifySubmission(input: {
  address: `0x${string}`;
  jobId: string;
  submissionId: string;
  deliverableUrl: string;
  criteria: string;
  attempt: number;
}) {
  if (!genLayerContract) throw new Error("GenLayer verifier is not configured.");
  const client = genLayerWriteClient(input.address);
  await client.connect("studionet");
  const hash = await client.writeContract({
    address: genLayerContract,
    functionName: "verify_submission",
    args: [`job:${input.jobId}`, `submission:${input.submissionId}`, `wallet:${input.address}`, input.deliverableUrl, input.criteria, input.attempt],
    value: 0n
  });
  await genLayerReadClient().waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED
  });
  return hash as `0x${string}`;
}

export async function readSubmissionVerdict(submissionId: string) {
  if (!genLayerContract) return { ready: false };
  return genLayerReadClient().readContract({
    address: genLayerContract,
    functionName: "get_submission_verdict",
    args: [`submission:${submissionId}`],
    jsonSafeReturn: true
  }) as Promise<Record<string, unknown>>;
}

export async function readRankings(jobId: string) {
  if (!genLayerContract) return [];
  return genLayerReadClient().readContract({
    address: genLayerContract,
    functionName: "get_rankings",
    args: [`job:${jobId}`],
    jsonSafeReturn: true
  }) as Promise<Record<string, unknown>[]>;
}
