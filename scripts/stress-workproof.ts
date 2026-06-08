import "dotenv/config";
import { execFileSync } from "node:child_process";
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
const genLayerContract = process.env.GENLAYER_CONTRACT;
const deployerKey = process.env.DEPLOYER_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATEKEY ?? process.env["private key"];
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const appUrl = process.env.WORKPROOF_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
const skipDb = process.env.STRESS_SKIP_DB === "1" || process.env.STRESS_SKIP_DB === "true";
const statePath = path.join(process.cwd(), ".stress-wallets.local.json");

const domains = ["frontend", "smart-contracts", "design", "content", "marketing"];
const statusLabels = ["Open", "Active", "UnderReview", "Failed", "Passed", "Complete", "Refunded"] as const;
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

const writingJobs = [
  ["Homepage Trust Copy for AI Escrow", "Write concise homepage copy that explains WorkProof to clients who are new to crypto escrow. The tone should feel professional, clear, and trust-first, avoiding hype and jargon."],
  ["Freelancer Onboarding Email Sequence", "Create a three-email onboarding sequence for freelancers joining WorkProof. The sequence should explain how to find jobs, submit proof, and claim rewards after GenLayer verification."],
  ["Client Guide to Acceptance Criteria", "Draft a practical guide that teaches clients how to write measurable acceptance criteria for writing, design, frontend, and smart contract jobs."],
  ["Protocol FAQ for Non-Technical Clients", "Write a plain-English FAQ that answers common client concerns about escrow, AI verification, retries, refunds, and what happens when a deadline passes."],
  ["Blog Post: Why Autonomous Escrow Matters", "Write a polished long-form blog post explaining the problem with traditional freelance marketplaces and how autonomous escrow improves trust for both sides."],
  ["Case Study: Marketing Copy Task", "Create a fictional but realistic case study showing how a client posts a marketing-copy job and a freelancer completes it through WorkProof."],
  ["Landing Page Comparison Section", "Write a comparison section for WorkProof versus traditional freelance platforms, focusing on fees, payment disputes, acceptance criteria, and transparent reputation."],
  ["Arbitrum Sepolia Demo Script", "Write a short demo script for a 90-second product walkthrough showing job posting, submission, GenLayer verification, and reward claim."],
  ["Developer Documentation Introduction", "Write an introductory documentation page for developers integrating WorkProof job data or contract events into their own dashboards."],
  ["Marketplace Empty State Copy", "Create professional empty-state copy for job board, activity feed, claim page, and leaderboard screens without sounding generic or fake."],
  ["Freelancer Profile Bio Pack", "Write ten sample freelancer profile bios for content, frontend, design, marketing, and smart contract specialists on WorkProof."],
  ["Investor One-Pager Copy", "Draft copy for a one-page investor summary covering problem, product, market, technical moat, and buildathon traction."],
  ["Security Explainer for Escrow", "Write a clear explainer describing escrow locking, pull payments, oracle whitelist, and why funds are not manually released by admins."],
  ["GenLayer Verification Explainer", "Write copy explaining how GenLayer validators review a deliverable against acceptance criteria and why consensus is stronger than a single API call."],
  ["Launch Announcement Thread", "Write a polished 8-post social launch thread announcing WorkProof for builders, freelancers, DAOs, and clients."],
  ["Claim Rewards Help Article", "Write a help article that explains when rewards become claimable, how to connect a wallet, and what to do if a claim transaction fails."],
  ["Retry Workflow Help Article", "Write a help article explaining failed AI review, retry limits, improvement guidance, and how freelancers can resubmit work."],
  ["DAO Grants Use Case Copy", "Write a use-case page explaining how DAOs can use WorkProof to escrow grant milestones and verify public deliverables."],
  ["Technical Glossary for Users", "Create a glossary defining escrow, deliverable URL, acceptance criteria, GenLayer, Arbitrum Sepolia, oracle, reputation, and claim queue."],
  ["Pricing and Fee Positioning Copy", "Write website copy that positions WorkProof as a lower-fee, transparent alternative to centralized freelance platforms."],
  ["Quality Bar Rubric", "Create a quality rubric for reviewing written deliverables, including clarity, structure, accuracy, tone, evidence, and completeness."],
  ["Client Job Template Pack", "Write five reusable job templates for blog post, landing page copy, technical documentation, email sequence, and social content tasks."],
  ["Freelancer Submission Checklist", "Create a checklist freelancers can use before submitting a deliverable URL for GenLayer review."],
  ["Dispute-Free Freelancing Article", "Write an article explaining how strong upfront criteria reduce subjective disputes and improve freelancer-client relationships."],
  ["Admin-Free Protocol Copy", "Write concise product copy explaining that WorkProof has no manual payment approvals while still preserving emergency controls."],
  ["Leaderboard Trust Score Explainer", "Write copy explaining reputation points, completed jobs, total earned, win rate, and how clients should interpret leaderboard rank."],
  ["Mobile App Microcopy", "Write polished microcopy for mobile UI states: posting, applying, submitting, under review, passed, failed, refunded, and claimed."],
  ["Buildathon Pitch Narrative", "Write a 3-minute pitch narrative for WorkProof covering problem, demo flow, technical architecture, and judging alignment."],
  ["Oracle Status Page Copy", "Write copy for an oracle monitor explaining heartbeat, wallet balance, pending verdicts, deadline checks, and failure states."],
  ["Content Style Guide", "Create a concise WorkProof writing style guide covering voice, tone, terminology, formatting, and examples of preferred copy."]
] as const;

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
  const targets = [
    { ...state.client, minimum: parseEther("0.13"), topUp: parseEther("0.13") },
    ...state.freelancers.map((freelancer) => ({ ...freelancer, minimum: parseEther("0.025"), topUp: parseEther("0.025") }))
  ];
  for (const target of targets) {
    const balance = await publicClient.getBalance({ address: target.address });
    if (balance >= target.minimum) continue;
    const hash = await funder.sendTransaction({ to: target.address, value: target.topUp });
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

function makeWritingJob(index: number) {
  const [title, brief] = writingJobs[index % writingJobs.length];
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 172800 + index * 2400);
  const description = brief;
  const acceptance = [
    `PROJECT BRIEF:\n${brief}`,
    "ACCEPTANCE CRITERIA:",
    "- Deliverable must be written in clear, polished English for a professional Web3 freelance platform.",
    "- Deliverable must directly address WorkProof's escrow, acceptance criteria, GenLayer verification, and claim/refund flow where relevant.",
    "- Deliverable must include a strong headline or title, structured sections, and scannable formatting.",
    "- Deliverable must avoid filler, generic AI-sounding phrasing, unsupported claims, and fake statistics.",
    "- Deliverable must be at least 700 words unless the requested format is microcopy, FAQ, thread, or checklist.",
    "- Deliverable must include concrete examples, user-facing wording, and a final revision pass for grammar and clarity.",
    "- Deliverable must be accessible by public URL and include enough context for GenLayer validators to verify every criterion."
  ].join("\n");
  return { domain: "content", title: `${title} #${index + 1}`, deadline, description, acceptance, assignedTo: undefined };
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
  if (skipDb) return;
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

async function postWritingJobs(count = 30) {
  const address = requireEnv(contractAddress, "WORKPROOF_CONTRACT") as Hex;
  const state = loadOrCreateWallets();
  const clientWallet = wallet(state.client.privateKey);
  const amount = parseEther("0.001");
  const ids = await publicClient.readContract({ address, abi: workProofAbi, functionName: "getJobIds" });
  const offset = ids.length;
  for (let i = 0; i < count; i++) {
    const job = makeWritingJob(offset + i);
    const hash = await clientWallet.writeContract({
      address,
      abi: workProofAbi,
      functionName: "postJob",
      args: [job.title, `writing://${offset + i}`, job.acceptance, job.domain, job.deadline, "0x0000000000000000000000000000000000000000"],
      value: amount
    });
    const receipt = await wait(hash);
    const [posted] = parseEventLogs({ abi: workProofAbi, logs: receipt.logs, eventName: "JobPosted" });
    if (!posted?.args.jobId) throw new Error(`JobPosted event missing for ${hash}`);
    await insertSupabaseJob({
      jobId: posted.args.jobId,
      client: state.client.address,
      title: job.title,
      description: job.description,
      acceptance: job.acceptance,
      domain: job.domain,
      amountWei: amount,
      deadline: job.deadline,
      txHash: hash
    });
    console.log(`posted writing ${i + 1}/${count}: ${job.title} ${posted.args.jobId}`);
  }
}

async function submitTen(limit = 10) {
  const address = requireEnv(contractAddress, "WORKPROOF_CONTRACT") as Hex;
  const state = loadOrCreateWallets();
  const ids = await publicClient.readContract({ address, abi: workProofAbi, functionName: "getJobIds" });
  const latest = [...ids].slice(0, 30).slice(0, limit);
  for (let i = 0; i < latest.length; i++) {
    const freelancer = state.freelancers[i % state.freelancers.length];
    const freelancerWallet = wallet(freelancer.privateKey);
    const deliverableUrl = `${appUrl.replace(/\/$/, "")}/api/stress/deliverable/${i + 1}`;
    const hash = await freelancerWallet.writeContract({ address, abi: workProofAbi, functionName: "submitWork", args: [latest[i], deliverableUrl] });
    await wait(hash);
    console.log(`submitted ${latest[i]} by ${freelancer.address}`);
  }
}

async function relayPassAndClaim(limit = 10) {
  const address = requireEnv(contractAddress, "WORKPROOF_CONTRACT") as Hex;
  const key = requireEnv(deployerKey, "DEPLOYER_PRIVATE_KEY");
  const oracleWallet = wallet(key as Hex);
  const state = loadOrCreateWallets();
  const ids = await publicClient.readContract({ address, abi: workProofAbi, functionName: "getJobIds" });
  const selected = [...ids].slice(0, 30).slice(0, limit);
  for (let i = 0; i < selected.length; i++) {
    const jobId = selected[i];
    const hash = await oracleWallet.writeContract({
      address,
      abi: workProofAbi,
      functionName: "receiveVerdict",
      args: [jobId, true, 88, "Stress verification passed via GenLayer/manual oracle relay path."]
    });
    await wait(hash);
    const freelancer = state.freelancers[i % state.freelancers.length];
    const freelancerWallet = wallet(freelancer.privateKey);
    const claimHash = await freelancerWallet.writeContract({ address, abi: workProofAbi, functionName: "claimReward", args: [jobId] });
    await wait(claimHash);
    console.log(`completed ${jobId} verdict=${hash} claim=${claimHash}`);
  }
}

function runGenLayer(args: string[]) {
  const output = execFileSync("genlayer", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const txHash = output.match(/(?:Write Transaction Hash|Transaction Hash):\s*\n?([0-9a-fA-Fx]{66})/)?.[1];
  const contractAddress = output.match(/Contract Address['"]?:\s*['"]?([0-9a-fA-Fx]{42})/)?.[1];
  const ready = output.match(/'ready'\s*=>\s*(true|false)|"ready"\s*:\s*(true|false)/);
  if (txHash) console.log(`genlayer_tx=${txHash}`);
  if (contractAddress) console.log(`genlayer_contract=${contractAddress}`);
  if (ready) console.log(`genlayer_ready=${ready[1] ?? ready[2]}`);
  if (!txHash && !contractAddress && !ready) console.log(output.split("\n").slice(-8).join("\n"));
  return output;
}

async function verifyTenWithGenLayer(_limit = 10) {
  // Disabled — non-oracle path that signed with the deployer key.
  // For an oracle-signed e2e flow use `scripts/e2e-oracle-submit.ts`,
  // which POSTs to /api/genlayer-trigger and signs with ORACLE_PRIVATE_KEY.
  throw new Error(
    "verifyTenWithGenLayer is disabled: use scripts/e2e-oracle-submit.ts (signs via /api/genlayer-trigger with the oracle wallet)."
  );
}

async function pollTenGenLayer(limit = 10) {
  const address = requireEnv(contractAddress, "WORKPROOF_CONTRACT") as Hex;
  const verifier = requireEnv(genLayerContract, "GENLAYER_CONTRACT");
  const ids = await publicClient.readContract({ address, abi: workProofAbi, functionName: "getJobIds" });
  const selected = [...ids].slice(0, 30).slice(0, limit);
  for (const jobId of selected) {
    console.log(`verdict ${jobId}`);
    runGenLayer(["call", verifier, "get_verdict", "--args", jobId]);
  }
}

async function syncFromChainToSupabase() {
  const address = requireEnv(contractAddress, "WORKPROOF_CONTRACT") as Hex;
  if (skipDb) throw new Error("sync-db requires Supabase; unset STRESS_SKIP_DB");
  const supabase = createClient(requireEnv(supabaseUrl, "SUPABASE_URL"), requireEnv(supabaseKey, "SUPABASE_SERVICE_KEY"), { auth: { persistSession: false } });
  const ids = await publicClient.readContract({ address, abi: workProofAbi, functionName: "getJobIds" });
  const jobsById = new Map<string, true>();

  for (let i = 0; i < ids.length; i++) {
    const job = await publicClient.readContract({ address, abi: workProofAbi, functionName: "getJob", args: [ids[i]] });
    jobsById.set(ids[i], true);
    const freelancer = job.assignedFreelancer === "0x0000000000000000000000000000000000000000" ? null : job.assignedFreelancer;
    await supabase.from("users").upsert({ wallet_address: job.client, role: "client", jobs_posted: 1 }, { onConflict: "wallet_address" });
    if (freelancer) await supabase.from("users").upsert({ wallet_address: freelancer, role: "freelancer" }, { onConflict: "wallet_address" });

    const claimed = await publicClient.readContract({ address, abi: workProofAbi, functionName: "rewardClaimed", args: [ids[i]] });
    const score = await publicClient.readContract({ address, abi: workProofAbi, functionName: "verdictQualityScore", args: [ids[i]] });
    const status = statusLabels[Number(job.status)] ?? "Open";
    const { error } = await supabase.from("jobs").upsert({
      job_id_onchain: ids[i],
      client_wallet: job.client,
      freelancer_wallet: freelancer,
      assigned_to_wallet: freelancer,
      title: job.title,
      description: `Stress-test ${job.domain} job ${i + 1}. This job was synced from the deployed WorkProof contract after the escrow stress run.`,
      spec_ipfs_hash: job.specIpfsHash || null,
      acceptance_criteria: job.acceptanceCriteria,
      domain: job.domain,
      escrow_amount_wei: job.escrowAmount.toString(),
      reward_amount_wei: job.rewardAmount.toString(),
      status,
      retry_count: Number(job.retryCount),
      deliverable_url: job.deliverableUrl || null,
      ai_verdict: Number(score) > 0 ? { source: "GenLayer stress run", quality_score: Number(score), summary: "Stress verification reached GenLayer readiness and was relayed through WorkProof." } : null,
      deadline: new Date(Number(job.deadline) * 1000).toISOString(),
      created_at: new Date(Number(job.createdAt) * 1000).toISOString(),
      completed_at: claimed ? new Date().toISOString() : null
    }, { onConflict: "job_id_onchain" });
    if (error) throw error;
    if (claimed && freelancer) {
      await supabase.from("claim_queue").upsert({
        job_id_onchain: ids[i],
        freelancer_wallet: freelancer,
        reward_wei: job.rewardAmount.toString(),
        quality_score: Number(score),
        ai_summary: "Reward claimed after GenLayer stress verification and oracle relay.",
        reputation_pts: Number(score) >= 90 ? 60 : Number(score) >= 75 ? 40 : Number(score) >= 60 ? 25 : 10,
        status: "claimed",
        claimed_at: new Date().toISOString()
      }, { onConflict: "job_id_onchain" });
    }
    console.log(`synced ${ids[i]} ${job.title}`);
  }

  const profiles = await publicClient.readContract({ address, abi: workProofAbi, functionName: "getTopFreelancers", args: [100n] });
  for (const profile of profiles) {
    if (profile.wallet === "0x0000000000000000000000000000000000000000") continue;
    await supabase.from("users").upsert({
      wallet_address: profile.wallet,
      role: "freelancer",
      domains: profile.domain ? [profile.domain] : null,
      reputation_pts: Number(profile.reputationPoints),
      jobs_completed: Number(profile.jobsCompleted),
      jobs_failed: Number(profile.jobsFailed),
      total_earned_wei: profile.totalEarned.toString()
    }, { onConflict: "wallet_address" });
  }

  const latest = await publicClient.getBlockNumber();
  const fromBlock = process.env.WORKPROOF_FROM_BLOCK ? BigInt(process.env.WORKPROOF_FROM_BLOCK) : latest > 250000n ? latest - 250000n : 0n;
  const logs = await publicClient.getLogs({ address, fromBlock, toBlock: "latest" });
  const events = parseEventLogs({
    abi: workProofAbi,
    logs,
    eventName: ["JobPosted", "JobAccepted", "WorkSubmitted", "VerdictReceived", "RewardClaimed", "JobRefunded", "ReputationAdded"]
  });
  for (const event of events) {
    const args = event.args as Record<string, unknown>;
    const eventType =
      event.eventName === "JobPosted" ? "job_posted" :
      event.eventName === "JobAccepted" ? "job_accepted" :
      event.eventName === "WorkSubmitted" ? "work_submitted" :
      event.eventName === "VerdictReceived" ? ((args.passed as boolean) ? "verdict_pass" : "verdict_fail") :
      event.eventName === "RewardClaimed" ? "reward_claimed" :
      event.eventName === "JobRefunded" ? "refund_issued" :
      "reputation_added";
    const jobId = String(args.jobId ?? "");
    if (jobId && !jobsById.has(jobId) && event.eventName !== "ReputationAdded") continue;
    await supabase.from("activity_log").upsert({
      event_type: eventType,
      job_id: jobId || null,
      actor_wallet: String(args.client ?? args.freelancer ?? ""),
      target_wallet: String(args.assignedTo ?? ""),
      metadata: Object.fromEntries(Object.entries(args).map(([key, value]) => [key, typeof value === "bigint" ? value.toString() : value])),
      tx_hash: event.transactionHash,
      created_at: new Date().toISOString()
    }, { onConflict: "tx_hash,event_type" });
  }

  console.log(`synced ${ids.length} jobs and ${events.length} events to Supabase`);
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
  if (phase === "verify10-genlayer") return verifyTenWithGenLayer();
  if (phase === "poll10-genlayer") return pollTenGenLayer();
  if (phase === "complete10") return relayPassAndClaim();
  if (phase === "post70") return postJobs(70, 30, 0);
  if (phase === "post-writing30") return postWritingJobs(30);
  if (phase === "sync-db") return syncFromChainToSupabase();
  if (phase === "balances") {
    for (const target of [state.client, ...state.freelancers]) {
      const balance = await publicClient.getBalance({ address: target.address });
      console.log(`${target.address}: ${formatEther(balance)} ETH`);
    }
    return;
  }
  throw new Error("Usage: npx tsx scripts/stress-workproof.ts wallets|fund|balances|post30|submit10|verify10-genlayer|poll10-genlayer|complete10|post70|post-writing30|sync-db");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
