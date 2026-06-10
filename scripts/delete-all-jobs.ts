// Clean slate: refund every non-terminal job on the current WorkProof
// contract (escrow returns to the client) and truncate Supabase caches.
//
// Usage:
//   npx tsx scripts/delete-all-jobs.ts --dry-run
//   npx tsx scripts/delete-all-jobs.ts --apply
import "dotenv/config";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { workProofAbi } from "../frontend/lib/contracts";

const apply = process.argv.includes("--apply");

const rpc = process.env.ARBITRUM_SEPOLIA_RPC ?? "https://sepolia-rollup.arbitrum.io/rpc";
const deployerKey = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
const contract = (process.env.WORKPROOF_CONTRACT ?? process.env.NEXT_PUBLIC_WORKPROOF_CONTRACT) as `0x${string}` | undefined;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseToken = process.env.SUPABASE_ACCESS_TOKEN ?? process.env.SUPABASE_ACCCESS_TOKEN;
const projectRef = supabaseUrl ? supabaseUrl.replace(/^https?:\/\//, "").split(".")[0] : undefined;

if (!deployerKey) throw new Error("DEPLOYER_PRIVATE_KEY required");
if (!contract) throw new Error("WORKPROOF_CONTRACT required");

// JobStatus enum: Open0 Active1 UnderReview2 Failed3 AwaitingApproval4 Passed5 Complete6 Refunded7 Deleted8
const TERMINAL = new Set([6, 7, 8]);

const account = privateKeyToAccount(deployerKey);
const pub = createPublicClient({ chain: arbitrumSepolia, transport: http(rpc) });
const wallet = createWalletClient({ chain: arbitrumSepolia, transport: http(rpc), account });

async function sql(query: string) {
  if (!projectRef || !supabaseToken) {
    console.warn("  (no Supabase Management token; skipping DB truncate)");
    return;
  }
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${supabaseToken}` },
    body: JSON.stringify({ query })
  });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  console.log(`mode: ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`contract: ${contract}`);
  console.log(`deployer: ${account.address}`);

  const ids = (await pub.readContract({ address: contract!, abi: workProofAbi, functionName: "getJobIds" })) as readonly Hex[];
  console.log(`\nfound ${ids.length} jobs`);

  let refunded = 0;
  for (const id of ids) {
    try {
      const job = (await pub.readContract({ address: contract!, abi: workProofAbi, functionName: "getJob", args: [id] })) as { status: number };
      if (TERMINAL.has(Number(job.status))) continue;
      if (!apply) { refunded++; continue; }
      const hash = await wallet.writeContract({
        address: contract!,
        abi: workProofAbi,
        functionName: "adminForceRefund",
        args: [id, "cleanup"]
      });
      await pub.waitForTransactionReceipt({ hash });
      refunded++;
      process.stdout.write(".");
    } catch (e) {
      process.stdout.write("x");
    }
  }
  console.log(`\n${apply ? "refunded" : "would refund"} ${refunded} non-terminal jobs`);

  const TABLES = ["jobs", "submissions", "applications", "claim_queue", "activity_log", "genlayer_submissions", "ingest_cursors", "notifications", "announcements", "disputes"];
  console.log(`\n${apply ? "truncating" : "would truncate"} DB tables: ${TABLES.join(", ")}`);
  if (apply) {
    for (const t of TABLES) {
      try {
        await sql(`truncate table public.${t} restart identity cascade;`);
        console.log(`  truncated ${t}`);
      } catch (e) {
        console.log(`  skipped ${t}: ${(e as Error).message.slice(0, 80)}`);
      }
    }
  }

  console.log(`\n${apply ? "CLEAN SLATE COMPLETE" : "DRY-RUN COMPLETE — re-run with --apply"}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
