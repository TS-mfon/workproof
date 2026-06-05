import { env } from "../config.js";
import { execFileSync } from "node:child_process";

// Triggers GenLayer verify_work via the genlayer CLI (uses oracle account).
// Falls back to a no-op with a warning if the CLI is unavailable (e.g. CI).
export async function triggerVerify(input: {
  jobId: string;
  deliverableUrl: string;
  acceptanceCriteria: string;
  retryCount: number;
}) {
  try {
    const output = execFileSync("genlayer", [
      "write",
      env.GENLAYER_CONTRACT,
      "verify_work",
      "--args",
      input.jobId,
      input.deliverableUrl,
      input.acceptanceCriteria,
      String(input.retryCount)
    ], {
      encoding: "utf8",
      timeout: 60_000,
      env: {
        ...process.env,
        // Ensure genlayer CLI uses studionet
        GENLAYER_NETWORK: "studionet"
      }
    });
    const txHash = output.match(/(?:Write Transaction Hash|Transaction Hash):\s*\n?([0-9a-fA-Fx]{66})/)?.[1];
    console.log(`[oracle] GenLayer verify_work triggered for ${input.jobId.slice(0, 14)}… tx: ${txHash ?? "pending"}`);
    return { ok: true, txHash };
  } catch (err: any) {
    // CLI unavailable or network error — the GenLayer poller will retry on the next cycle
    console.warn(
      `[oracle] triggerVerify failed for ${input.jobId.slice(0, 14)}… — poller will retry. Error: ${err?.message?.slice(0, 120)}`
    );
    return { ok: false };
  }
}
