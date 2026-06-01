import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  parseEventLogs,
  parseEther,
  type Hex
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { workProofAbi } from "../frontend/lib/contracts";

const rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC ?? process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC ?? "https://sepolia-rollup.arbitrum.io/rpc";
const contractAddress = process.env.WORKPROOF_CONTRACT ?? process.env.NEXT_PUBLIC_WORKPROOF_CONTRACT;
const deployerKey = process.env.DEPLOYER_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATEKEY ?? process.env["private key"];
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const appUrl = process.env.WORKPROOF_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
const statePath = path.join(process.cwd(), ".stress-wallets.local.json");

const domains = ["frontend", "smart-contracts", "design", "content", "marketing"];
const titles = [
  "Landing Page Refresh",
  "Escrow Status Widget",
  "Protocol Explainer Copy",
  "Dashboard UX Pass",
  "Smart Contract Review",
  "Activity Feed Polish",
  "Leaderboard Layout",
  "Marketing One Pager",
  "Claim Flow QA",
  "Mobile Navigation"
];

type WalletState = {
  client: { address: Hex; privateKey: Hex };
  freelancers: Array<{ address: Hex; privateKey: Hex }>;
};

function requireEnv(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function loadOrCreateWallets(): WalletState {
  if (fs.existsSync(statePath)) return JSON.parse(fs.readFileSync(statePath, "utf8"));
  const clientKey = generatePrivateKey();
  const freelancerKeys = Array.from({ length: 4 }, () => generatePrivateKey());
  const state = {
    client: { privateKey: clientKey, address: privateKeyToAccount(clientKey).address },
    freelancers: freelancerKeys.map((privateKey) => ({ privateKey, address: privateKeyToAccount(privateKey).address }))
  };
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  return state;
}

function wallet(privateKey: Hex) {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({ account, chain: arbitrumSepolia, transport: http(rpcUrl) });
}

async function wait(hash: Hex) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  if (receipt.status !== "success") throw new Error(`Transaction failed: ${hash}`);
  return receipt;
}

const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(rpcUrl) });

async function fundWallets(state: WalletState) {
  const key = requireEnv(deployerKey, "DEPLOYER_PRIVATE_KEY");
  const funder = wallet(key as Hex);
  const targets = [state.client, ...state.freelancers];
  for (const target of targets) {
    const balance = await publicClient.getBalance({ address: target.address });
    if (balance >= parseEther("0.015")) continue;
    const hash = await funder.sendTransaction({ to: target.address, value: parseEther("0.02") });
    await wait(hash);
    console.log(`funded ${target.address} ${hash}`);
  }
}

function makeJob(index: number, assignedTo?: Hex) {
  const domain = domains[index % domains.length];
  const title = `${titles[index % titles.length]} #${index + 1}`;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400 + index * 1800);
  const description = `Stress-test ${domain} job ${index + 1}. This job validates WorkProof escrow, GenLayer review, oracle relay, activity, and leaderboard data.`;
  const acceptance = [
    `Deliverable must clearly complete ${title}.`,
    "Deliverable must include implementation notes.",
    "Deliverable must include evidence for every acceptance criterion.",
    "Deliverable must be accessible by public URL."
  ].join("\n");
  return { domain, title, deadline, description, acceptance, assignedTo };
}

async function insertSupabaseJob(input: {
  jobId: Hex;
  client: Hex;
  freelancer?: Hex;
  title: string;
  description: string;
  acceptance: string;
  domain: string;
  amountWei: bigint;
  deadline: bigint;
  txHash: Hex;
}) {
  const supabase = createClient(requireEnv(supabaseUrl, "SUPABASE_URL"), requireEnv(supabaseKey, "SUPABASE_SERVICE_KEY"), { auth: { persistSession: false } });
  await supabase.from("users").upsert({ wallet_address: input.client, role: "client" }, { onConflict: "wallet_address" });
  if (input.freelancer) await supabase.from("users").upsert({ wallet_address: input.freelancer, role: "freelancer" }, { onConflict: "wallet_address" });
  const { error } = await supabase.from("jobs").upsert({
    job_id_onchain: input.jobId,
    client_wallet: input.client,
    freelancer_wallet: input.freelancer ?? null,
    assigned_to_wallet: input.freelancer ?? null,
    title: input.title,
    description: input.description,
    acceptance_criteria: input.acceptance,
    domain: input.domain,
    escrow_amount_wei: input.amountWei.toString(),
    reward_amount_wei: input.amountWei.toString(),
    status: input.freelancer ? "Active" : "Open",
    retry_count: 0,
    deadline: new Date(Number(input.deadline) * 1000).toISOString()
  }, { onConflict: "job_id_onchain" });
  if (error) throw error;
  await supabase.from("activity_log").insert({
    event_type: "job_posted",
    job_id: input.jobId,
    actor_wallet: input.client,
    target_wallet: input.freelancer ?? null,
    metadata: { title: input.title, domain: input.domain, amount: input.amountWei.toString() },
    tx_hash: input.txHash
  });
}

async function postJobs(count: number, offset: number, assignFirst = 0) {
  const address = requireEnv(contractAddress, "WORKPROOF_CONTRACT") as Hex;
  const state = loadOrCreateWallets();
  const clientWallet = wallet(state.client.privateKey);
  const amount = parseEther("0.001");
  for (let i = 0; i < count; i++) {
    const freelancer = i < assignFirst ? state.freelancers[i % state.freelancers.length].address : undefined;
    const job = makeJob(offset + i, freelancer);
    const hash = await clientWallet.writeContract({
      address,
      abi: workProofAbi,
      functionName: "postJob",
      args: [job.title, `stress://${offset + i}`, job.acceptance, job.domain, job.deadline, freelancer ?? "0x0000000000000000000000000000000000000000"],
      value: amount
    });
    const receipt = await wait(hash);
    const [posted] = parseEventLogs({ abi: workProofAbi, logs: receipt.logs, eventName: "JobPosted" });
    if (!posted?.args.jobId) throw new Error(`JobPosted event missing for ${hash}`);
    const jobId = posted.args.jobId;
    await insertSupabaseJob({
      jobId,
      client: state.client.address,
      freelancer,
      title: job.title,
      description: job.description,
      acceptance: job.acceptance,
      domain: job.domain,
      amountWei: amount,
      deadline: job.deadline,
      txHash: hash
    });
    console.log(`posted ${offset + i + 1}/${offset + count}: ${job.title} ${jobId}`);
  }
}

async function submitTen() {
  const address = requireEnv(contractAddress, "WORKPROOF_CONTRACT") as Hex;
  const state = loadOrCreateWallets();
  const ids = await publicClient.readContract({ address, abi: workProofAbi, functionName: "getJobIds" });
  const latest = [...ids].slice(0, 30).slice(0, 10);
  for (let i = 0; i < latest.length; i++) {
    const freelancer = state.freelancers[i % state.freelancers.length];
    const freelancerWallet = wallet(freelancer.privateKey);
    const deliverableUrl = `${appUrl.replace(/\/$/, "")}/api/stress/deliverable/${i + 1}`;
    const hash = await freelancerWallet.writeContract({ address, abi: workProofAbi, functionName: "submitWork", args: [latest[i], deliverableUrl] });
    await wait(hash);
    console.log(`submitted ${latest[i]} by ${freelancer.address}`);
  }
}

async function main() {
  const phase = process.argv[2];
  const state = loadOrCreateWallets();
  console.log(`client=${state.client.address}`);
  console.log(`freelancers=${state.freelancers.map((f) => f.address).join(",")}`);
  if (phase === "wallets") return;
  if (phase === "fund") return fundWallets(state);
  if (phase === "post30") return postJobs(30, 0, 10);
  if (phase === "submit10") return submitTen();
  if (phase === "post70") return postJobs(70, 30, 0);
  if (phase === "balances") {
    for (const target of [state.client, ...state.freelancers]) {
      const balance = await publicClient.getBalance({ address: target.address });
      console.log(`${target.address}: ${formatEther(balance)} ETH`);
    }
    return;
  }
  throw new Error("Usage: npx tsx scripts/stress-workproof.ts wallets|fund|balances|post30|submit10|post70");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
