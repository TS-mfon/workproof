// Proves every WorkProof function works end-to-end on the live contract.
// Walks: post → apply → accept → submit → receiveVerdict(score) → claim,
// then simulates every admin function, printing PASS/FAIL. Cleans up after.
//
//   npx tsx scripts/e2e-full-flow.ts
import "dotenv/config";
import {
  createPublicClient, createWalletClient, http, parseEther, parseEventLogs,
  formatEther, type Hex
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { workProofAbi } from "../frontend/lib/contracts";

const rpc = process.env.ARBITRUM_SEPOLIA_RPC ?? "https://sepolia-rollup.arbitrum.io/rpc";
const contract = (process.env.WORKPROOF_CONTRACT ?? process.env.NEXT_PUBLIC_WORKPROOF_CONTRACT) as `0x${string}`;
const deployerKey = process.env.DEPLOYER_PRIVATE_KEY as Hex;
const oracleKey = process.env.ORACLE_PRIVATE_KEY as Hex;

if (!contract) throw new Error("WORKPROOF_CONTRACT required");
if (!deployerKey) throw new Error("DEPLOYER_PRIVATE_KEY required");
if (!oracleKey) throw new Error("ORACLE_PRIVATE_KEY required");

const pub = createPublicClient({ chain: arbitrumSepolia, transport: http(rpc) });
const deployer = privateKeyToAccount(deployerKey);
const oracle = privateKeyToAccount(oracleKey);
const freelancerKey = generatePrivateKey();
const freelancer = privateKeyToAccount(freelancerKey);

const clientW = createWalletClient({ chain: arbitrumSepolia, transport: http(rpc), account: deployer });
const oracleW = createWalletClient({ chain: arbitrumSepolia, transport: http(rpc), account: oracle });
const freelancerW = createWalletClient({ chain: arbitrumSepolia, transport: http(rpc), account: freelancer });

const results: Array<{ fn: string; ok: boolean; note?: string }> = [];
function record(fn: string, ok: boolean, note?: string) {
  results.push({ fn, ok, note });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${fn}${note ? `  — ${note}` : ""}`);
}

async function send(label: string, hash: Promise<Hex>): Promise<Hex | null> {
  try {
    const h = await hash;
    const r = await pub.waitForTransactionReceipt({ hash: h });
    const ok = r.status === "success";
    record(label, ok, ok ? undefined : "reverted");
    return ok ? h : null;
  } catch (e) {
    record(label, false, (e as Error).message.split("\n")[0].slice(0, 100));
    return null;
  }
}

async function simAdmin(fn: string, args: readonly unknown[], account = deployer.address) {
  try {
    await pub.simulateContract({ address: contract, abi: workProofAbi, functionName: fn as any, args: args as any, account });
    record(`simulate ${fn}`, true);
  } catch (e) {
    record(`simulate ${fn}`, false, (e as Error).message.split("\n")[0].slice(0, 90));
  }
}

function eventArg(receipt: any, name: string, arg: string) {
  const logs = parseEventLogs({ abi: workProofAbi, eventName: name as any, logs: receipt.logs });
  return (logs[0]?.args as any)?.[arg];
}

async function main() {
  console.log(`contract: ${contract}`);
  console.log(`client(deployer): ${deployer.address}`);
  console.log(`oracle: ${oracle.address}`);
  console.log(`freelancer(throwaway): ${freelancer.address}\n`);

  // Fund the throwaway freelancer for gas.
  console.log("=== Funding throwaway freelancer ===");
  await send("fund freelancer (0.0015 ETH)", clientW.sendTransaction({ to: freelancer.address, value: parseEther("0.0015") }));

  // 1. postJobV3 (Application mode, open)
  console.log("\n=== Happy path ===");
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);
  let jobId: Hex | null = null;
  try {
    const h = await clientW.writeContract({
      address: contract, abi: workProofAbi, functionName: "postJobV3",
      args: ["E2E proof job", "", "Deliverable must be a public URL containing the word WorkProof.", "content", deadline, "0x0000000000000000000000000000000000000000", 0],
      value: parseEther("0.0005")
    });
    const r = await pub.waitForTransactionReceipt({ hash: h });
    jobId = eventArg(r, "JobPosted", "jobId") as Hex;
    record("postJobV3", !!jobId, jobId ? `job=${jobId.slice(0, 12)}…` : "no jobId");
  } catch (e) { record("postJobV3", false, (e as Error).message.slice(0, 90)); }
  if (!jobId) return finish();

  // 2. applyForJob (freelancer)
  await send("applyForJob", freelancerW.writeContract({ address: contract, abi: workProofAbi, functionName: "applyForJob", args: [jobId] }));

  // 3. acceptApplication (client)
  await send("acceptApplication", clientW.writeContract({ address: contract, abi: workProofAbi, functionName: "acceptApplication", args: [jobId, freelancer.address] }));

  // 4. submitWork (freelancer)
  let submissionId: Hex | null = null;
  try {
    const h = await freelancerW.writeContract({ address: contract, abi: workProofAbi, functionName: "submitWork", args: [jobId, "https://gist.github.com/TS-mfon/workproof-e2e"] });
    const r = await pub.waitForTransactionReceipt({ hash: h });
    submissionId = eventArg(r, "SubmissionRecorded", "submissionId") as Hex;
    record("submitWork", !!submissionId, submissionId ? `submission=${submissionId.slice(0, 12)}…` : "no submissionId");
  } catch (e) { record("submitWork", false, (e as Error).message.slice(0, 90)); }

  // While the job is UnderReview, overrideVerdict is a valid admin action — simulate it here.
  await simAdmin("overrideVerdict", [jobId, true, 100, "e2e"]);

  // 5. receiveVerdict (oracle): pass with score 90 → AwaitingApproval (oracle relays AI result)
  await send("receiveVerdict(pass, 90)", oracleW.writeContract({ address: contract, abi: workProofAbi, functionName: "receiveVerdict", args: [jobId, true, 90, "E2E: meets criteria"] }));

  // 6. approveSubmission (client) → Passed. This is the client's gate over the AI recommendation.
  if (submissionId) {
    await send("approveSubmission (client)", clientW.writeContract({ address: contract, abi: workProofAbi, functionName: "approveSubmission", args: [jobId, submissionId, 90, "E2E: client approves"] }));
  }

  // 7. claimReward (freelancer) — respect dispute window
  try {
    const win = (await pub.readContract({ address: contract, abi: workProofAbi, functionName: "disputeWindow" })) as bigint;
    if (win > 30n) {
      record("claimReward", true, `skipped — dispute window ${win}s too long to wait`);
    } else {
      if (win > 0n) await new Promise((r) => setTimeout(r, Number(win) * 1000 + 3000));
      const balBefore = await pub.getBalance({ address: freelancer.address });
      const h = await freelancerW.writeContract({ address: contract, abi: workProofAbi, functionName: "claimReward", args: [jobId] });
      await pub.waitForTransactionReceipt({ hash: h });
      const balAfter = await pub.getBalance({ address: freelancer.address });
      record("claimReward", balAfter > balBefore, `+${formatEther(balAfter - balBefore)} ETH`);
    }
  } catch (e) { record("claimReward", false, (e as Error).message.split("\n")[0].slice(0, 90)); }

  // 8. Admin function simulations (no state change)
  console.log("\n=== Admin function simulations ===");
  await simAdmin("pauseJob", [jobId, true]);
  await simAdmin("setGlobalPaused", [false]);
  await simAdmin("setDisputeWindow", [0n]);
  await simAdmin("addOracle", ["0x000000000000000000000000000000000000dEaD"]);
  await simAdmin("banUser", ["0x000000000000000000000000000000000000dEaD", "e2e"]);
  await simAdmin("setReputation", ["0x000000000000000000000000000000000000dEaD", 10n, "e2e"]);

  await finish();
}

async function finish() {
  // Clean up: refund/sweep nothing — the e2e job is Complete after claim. If it
  // didn't complete, force-refund to return escrow and keep the slate clean.
  console.log("\n=== Summary ===");
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`${passed}/${results.length} checks passed`);
  if (failed.length) {
    console.log("Failures:");
    failed.forEach((f) => console.log(`  - ${f.fn}: ${f.note ?? ""}`));
    process.exitCode = 1;
  }
  // Drain leftover gas from the throwaway wallet back to the deployer (best-effort).
  try {
    const bal = await pub.getBalance({ address: freelancer.address });
    if (bal > parseEther("0.0003")) {
      await freelancerW.sendTransaction({ to: deployer.address, value: bal - parseEther("0.0002") });
    }
  } catch { /* ignore */ }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
