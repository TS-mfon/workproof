"use client";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

export const genLayerContract = (process.env.NEXT_PUBLIC_GENLAYER_CONTRACT ?? "") as `0x${string}`;

const READ_TIMEOUT_MS = 15_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout:${label}`)), ms))
  ]);
}

export function genLayerReadClient() {
  return createClient({ chain: studionet });
}

export async function readSubmissionVerdict(submissionId: string) {
  if (!genLayerContract) return { ready: false };
  try {
    return (await withTimeout(
      genLayerReadClient().readContract({
        address: genLayerContract,
        functionName: "get_submission_verdict",
        args: [`submission:${submissionId}`],
        jsonSafeReturn: true
      }) as Promise<Record<string, unknown>>,
      READ_TIMEOUT_MS,
      "get_submission_verdict"
    )) as Record<string, unknown>;
  } catch (err) {
    console.warn("[genlayer] readSubmissionVerdict failed:", (err as Error).message);
    return { ready: false };
  }
}

export async function readRankings(jobId: string) {
  if (!genLayerContract) return [];
  try {
    return (await withTimeout(
      genLayerReadClient().readContract({
        address: genLayerContract,
        functionName: "get_rankings",
        args: [`job:${jobId}`],
        jsonSafeReturn: true
      }) as Promise<Record<string, unknown>[]>,
      READ_TIMEOUT_MS,
      "get_rankings"
    )) as Record<string, unknown>[];
  } catch (err) {
    console.warn("[genlayer] readRankings failed:", (err as Error).message);
    return [];
  }
}
