import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  parseEventLogs,
  type Hex
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";

const rpc = process.env.ARBITRUM_SEPOLIA_RPC ?? "https://sepolia-rollup.arbitrum.io/rpc";
const workProofAddress = process.env.WORKPROOF_CONTRACT as `0x${string}`;
const verifier = process.env.GENLAYER_CONTRACT as `0x${string}`;
const genLayerRpc = process.env.GENLAYER_STUDIO_RPC ?? "https://studio.genlayer.com/api";
const apiBase = process.env.API_BASE_URL ?? "http://localhost:3000";

// The deployer key here funds the test jobs only — runtime GenLayer signing
// goes through the API route which uses ORACLE_PRIVATE_KEY.
const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as Hex);
const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(rpc) });
const wallet = createWalletClient({ chain: arbitrumSepolia, transport: http(rpc), account });

const abi = [
  { type: "event", name: "JobPosted", inputs: [{ name: "jobId", type: "bytes32", indexed: true }, { name: "client", type: "address", indexed: true }, { name: "amount", type: "uint256" }, { name: "domain", type: "string" }, { name: "assignedTo", type: "address" }] },
  { type: "event", name: "SubmissionRecorded", inputs: [{ name: "jobId", type: "bytes32", indexed: true }, { name: "submissionId", type: "bytes32", indexed: true }, { name: "freelancer", type: "address", indexed: true }, { name: "attempt", type: "uint256" }, { name: "deliverableUrl", type: "string" }] },
  { type: "function", name: "postJobV3", stateMutability: "payable", inputs: [{ type: "string" }, { type: "string" }, { type: "string" }, { type: "string" }, { type: "uint256" }, { type: "address" }, { type: "uint8" }], outputs: [{ type: "bytes32" }] },
  { type: "function", name: "submitWork", stateMutability: "nonpayable", inputs: [{ type: "bytes32" }, { type: "string" }], outputs: [{ type: "bytes32" }] }
] as const;

type Archetype = {
  name: string;
  domain: string;
  criteria: string;
  deliverable: string;
  expectPass: boolean;
  attempts?: number; // how many sequential submissions to make (for retry case)
};

const ARCHETYPES: Archetype[] = [
  {
    name: "writing",
    domain: "content",
    criteria: "The public deliverable must load without login, contain at least 800 words, and describe a real-world topic with at least 3 references.",
    deliverable: "https://arbworkproof.vercel.app/api/stress/deliverable/1",
    expectPass: true
  },
  {
    name: "code",
    domain: "smart-contracts",
    criteria: "Public Gist contains a Python function with docstring and passes the trivial test cases listed in the README.",
    deliverable: "https://gist.githubusercontent.com/TS-mfon/c9456791b3ca4f10deae68c13105a088/raw",
    expectPass: true
  },
  {
    name: "design",
    domain: "design",
    criteria: "Public URL renders an image and the image visibly contains text/branding elements.",
    deliverable: "https://arbworkproof.vercel.app/api/stress/deliverable/2",
    expectPass: true
  },
  {
    name: "failing-off-topic",
    domain: "content",
    criteria: "Deliverable must be a long-form essay about distributed systems.",
    deliverable: "https://example.com/",
    expectPass: false
  },
  {
    name: "retry-after-fail",
    domain: "content",
    criteria: "Deliverable must contain readable text about WorkProof.",
    deliverable: "https://arbworkproof.vercel.app/api/stress/deliverable/1",
    expectPass: true,
    attempts: 2
  },
  {
    name: "content-writing-gist",
    domain: "content",
    criteria:
      "Deliverable must be a public Gist containing a 400-word article about freelance escrow on Arbitrum. Must mention WorkProof, GenLayer, and AI verification at least once.",
    deliverable:
      "https://gist.githubusercontent.com/TS-mfon/47ac0822d06c833cc60e4ad77f8cf28c/raw",
    expectPass: true
  }
];

function eventArg(receipt: any, name: "JobPosted" | "SubmissionRecorded", arg: string) {
  const logs = parseEventLogs({ abi, eventName: name, logs: receipt.logs });
  return (logs[0].args as any)[arg] as Hex;
}

async function genLayerRead(method: string, args: unknown[]) {
  const res = await fetch(genLayerRpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "gen_callContractMethod",
      params: { contract: verifier, method, args }
    })
  });
  if (!res.ok) throw new Error(`GenLayer ${method} HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(`GenLayer ${method} RPC error: ${body.error.message ?? "unknown"}`);
  return body.result;
}

async function triggerOracle(payload: Record<string, unknown>) {
  const res = await fetch(`${apiBase}/api/genlayer-trigger`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) {
    throw new Error(`oracle ${res.status} ${body.code ?? ""} ${body.error ?? ""}`);
  }
  return body.glTxId as string;
}

async function waitForVerdict(submissionId: Hex, timeoutMs = 5 * 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const v = await genLayerRead("get_submission_verdict", [`submission:${submissionId}`]);
      if (v?.ready) return v;
    } catch (err) {
      console.warn(`  read failed: ${(err as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 15_000));
  }
  throw new Error("verdict timeout");
}

async function runArchetype(arch: Archetype) {
  console.log(`\n=== ${arch.name} ===`);
  const post = await wallet.writeContract({
    address: workProofAddress,
    abi,
    functionName: "postJobV3",
    args: [
      `E2E ${arch.name}`,
      `workproof-e2e://${arch.name}`,
      arch.criteria,
      arch.domain,
      BigInt(Math.floor(Date.now() / 1000) + 86400),
      account.address,
      1
    ],
    value: parseEther("0.0005")
  });
  const jobReceipt = await publicClient.waitForTransactionReceipt({ hash: post });
  const jobId = eventArg(jobReceipt, "JobPosted", "jobId");
  console.log(`  job=${jobId}`);

  const attempts = arch.attempts ?? 1;
  let finalVerdict: any = null;
  let finalSubmissionId: Hex | null = null;

  for (let i = 0; i < attempts; i++) {
    const deliverable = i === 0 && arch.name === "retry-after-fail" ? "https://example.com/" : arch.deliverable;
    const submit = await wallet.writeContract({
      address: workProofAddress,
      abi,
      functionName: "submitWork",
      args: [jobId, deliverable]
    });
    const subReceipt = await publicClient.waitForTransactionReceipt({ hash: submit });
    const submissionId = eventArg(subReceipt, "SubmissionRecorded", "submissionId");
    const attemptNum = Number((parseEventLogs({ abi, eventName: "SubmissionRecorded", logs: subReceipt.logs })[0].args as any).attempt);
    console.log(`  attempt=${attemptNum} submission=${submissionId} url=${deliverable}`);

    const glTxId = await triggerOracle({
      jobId,
      submissionId,
      freelancer: account.address,
      deliverableUrl: deliverable,
      criteria: arch.criteria,
      attempt: attemptNum
    });
    console.log(`  oracle signed gl=${glTxId}`);

    finalVerdict = await waitForVerdict(submissionId);
    finalSubmissionId = submissionId;
    console.log(`  verdict: meets_criteria=${finalVerdict.meets_criteria} score=${finalVerdict.quality_score}`);
  }

  const passed = Boolean(finalVerdict?.meets_criteria);
  const ok = passed === arch.expectPass;
  return { name: arch.name, ok, passed, expected: arch.expectPass, submissionId: finalSubmissionId };
}

async function main() {
  if (!workProofAddress || !verifier) throw new Error("WORKPROOF_CONTRACT and GENLAYER_CONTRACT required");

  const results: Array<{ name: string; ok: boolean; passed: boolean; expected: boolean }> = [];
  for (const arch of ARCHETYPES) {
    try {
      results.push(await runArchetype(arch));
    } catch (err) {
      console.error(`  FAILED ${arch.name}: ${(err as Error).message}`);
      results.push({ name: arch.name, ok: false, passed: false, expected: arch.expectPass });
    }
  }

  console.log("\n=== SUMMARY ===");
  for (const r of results) {
    console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name}  (got passed=${r.passed} expected=${r.expected})`);
  }
  const allOk = results.every((r) => r.ok);
  if (!allOk) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
