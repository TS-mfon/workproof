import "dotenv/config";
import { execFileSync } from "node:child_process";
import { createPublicClient, createWalletClient, http, parseEther, parseEventLogs, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";

const rpc = process.env.ARBITRUM_SEPOLIA_RPC ?? "https://sepolia-rollup.arbitrum.io/rpc";
const address = process.env.WORKPROOF_CONTRACT as `0x${string}`;
const verifier = process.env.GENLAYER_CONTRACT as `0x${string}`;
const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as Hex);
const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(rpc) });
const wallet = createWalletClient({ chain: arbitrumSepolia, transport: http(rpc), account });

const abi = [
  { type: "event", name: "JobPosted", inputs: [{ name: "jobId", type: "bytes32", indexed: true }, { name: "client", type: "address", indexed: true }, { name: "amount", type: "uint256" }, { name: "domain", type: "string" }, { name: "assignedTo", type: "address" }] },
  { type: "event", name: "SubmissionRecorded", inputs: [{ name: "jobId", type: "bytes32", indexed: true }, { name: "submissionId", type: "bytes32", indexed: true }, { name: "freelancer", type: "address", indexed: true }, { name: "attempt", type: "uint256" }, { name: "deliverableUrl", type: "string" }] },
  { type: "function", name: "postJobV3", stateMutability: "payable", inputs: [{ type: "string" }, { type: "string" }, { type: "string" }, { type: "string" }, { type: "uint256" }, { type: "address" }, { type: "uint8" }], outputs: [{ type: "bytes32" }] },
  { type: "function", name: "submitWork", stateMutability: "nonpayable", inputs: [{ type: "bytes32" }, { type: "string" }], outputs: [{ type: "bytes32" }] },
  { type: "function", name: "approveSubmission", stateMutability: "nonpayable", inputs: [{ type: "bytes32" }, { type: "bytes32" }, { type: "uint8" }, { type: "string" }], outputs: [] },
  { type: "function", name: "claimReward", stateMutability: "nonpayable", inputs: [{ type: "bytes32" }], outputs: [] }
] as const;

function eventArg(receipt: any, name: "JobPosted" | "SubmissionRecorded", arg: string) {
  const logs = parseEventLogs({ abi, eventName: name, logs: receipt.logs });
  return (logs[0].args as any)[arg] as Hex;
}

function genlayer(args: string[]) {
  return execFileSync("genlayer", args, { encoding: "utf8", timeout: 10 * 60 * 1000 });
}

const apiBase = process.env.API_BASE_URL ?? "http://localhost:3000";

async function triggerOracleSign(payload: {
  jobId: Hex;
  submissionId: Hex;
  freelancer: `0x${string}`;
  deliverableUrl: string;
  criteria: string;
  attempt: number;
}) {
  const res = await fetch(`${apiBase}/api/genlayer-trigger`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) {
    throw new Error(`oracle ${res.status} ${body.code ?? ""} ${body.error ?? ""}`);
  }
  return body as { glTxId: string; oracleAddress: string; alreadySigned?: boolean };
}

async function main() {
  if (process.argv[2] === "finalize") {
    const jobId = process.argv[3] as Hex;
    const submissionId = process.argv[4] as Hex;
    const score = Number(process.argv[5] ?? 80);
    const approve = await wallet.writeContract({ address, abi, functionName: "approveSubmission", args: [jobId, submissionId, score, "Real V3 GenLayer workflow verification"] });
    await publicClient.waitForTransactionReceipt({ hash: approve });
    const claim = await wallet.writeContract({ address, abi, functionName: "claimReward", args: [jobId] });
    await publicClient.waitForTransactionReceipt({ hash: claim });
    console.log(`v3_e2e_complete job=${jobId} submission=${submissionId} score=${score}`);
    return;
  }
  const criteria = "The public deliverable must load without login and contain readable text describing WorkProof.";
  const deliverable = "https://arbworkproof.vercel.app/api/stress/deliverable/1";
  const post = await wallet.writeContract({
    address, abi, functionName: "postJobV3",
    args: ["V3 browser workflow verification", "workproof-v3://e2e", criteria, "content", BigInt(Math.floor(Date.now() / 1000) + 86400), account.address, 1],
    value: parseEther("0.0005")
  });
  const jobId = eventArg(await publicClient.waitForTransactionReceipt({ hash: post }), "JobPosted", "jobId");
  const submit = await wallet.writeContract({ address, abi, functionName: "submitWork", args: [jobId, deliverable] });
  const submissionId = eventArg(await publicClient.waitForTransactionReceipt({ hash: submit }), "SubmissionRecorded", "submissionId");

  const signed = await triggerOracleSign({
    jobId,
    submissionId,
    freelancer: account.address,
    deliverableUrl: deliverable,
    criteria,
    attempt: 1
  });
  console.log(`oracle signed via API base=${apiBase} gl=${signed.glTxId} oracle=${signed.oracleAddress}${signed.alreadySigned ? " (replay)" : ""}`);
  let verdict = "";
  for (let i = 0; i < 12; i++) {
    verdict = genlayer(["call", verifier, "get_submission_verdict", "--args", `submission:${submissionId}`]);
    if (verdict.includes("ready") && verdict.includes("true")) break;
    await new Promise((resolve) => setTimeout(resolve, 15000));
  }
  if (!verdict.includes("ready") || !verdict.includes("true")) throw new Error("GenLayer verdict did not become ready");
  const score = Math.max(1, Math.min(100, Number(verdict.match(/quality_score[^0-9]+([0-9]+)/)?.[1] ?? 80)));
  const approve = await wallet.writeContract({ address, abi, functionName: "approveSubmission", args: [jobId, submissionId, score, "Real V3 GenLayer workflow verification"] });
  await publicClient.waitForTransactionReceipt({ hash: approve });
  const claim = await wallet.writeContract({ address, abi, functionName: "claimReward", args: [jobId] });
  await publicClient.waitForTransactionReceipt({ hash: claim });
  console.log(`v3_e2e_complete job=${jobId} submission=${submissionId} score=${score}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
