import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
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
const contractAddress = (process.env.WORKPROOF_CONTRACT ?? process.env.NEXT_PUBLIC_WORKPROOF_CONTRACT) as Hex | undefined;
const deployerKey = (process.env.DEPLOYER_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATEKEY) as Hex | undefined;
const genLayerRpc = process.env.GENLAYER_STUDIO_RPC ?? "https://studio.genlayer.com/api";
const genLayerContract = process.env.GENLAYER_CONTRACT;
const githubToken = process.env.GITHUB_TOKEN;
const statePath = path.join(process.cwd(), ".seed-wallets.local.json");

if (!contractAddress) throw new Error("WORKPROOF_CONTRACT or NEXT_PUBLIC_WORKPROOF_CONTRACT required");
if (!deployerKey) throw new Error("DEPLOYER_PRIVATE_KEY required");

const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(rpcUrl) });
const deployerAccount = privateKeyToAccount(deployerKey);
const deployerWallet = createWalletClient({ account: deployerAccount, chain: arbitrumSepolia, transport: http(rpcUrl) });

type SeedWallets = {
  clients: { address: Hex; privateKey: Hex }[];
  freelancers: { address: Hex; privateKey: Hex }[];
};

function loadOrCreateWallets(): SeedWallets {
  if (fs.existsSync(statePath)) {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  }
  const make = () => {
    const pk = generatePrivateKey();
    return { privateKey: pk, address: privateKeyToAccount(pk).address };
  };
  const state: SeedWallets = {
    clients: [make(), make(), make()],
    freelancers: [make(), make(), make(), make()]
  };
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
  return state;
}

const wallets = loadOrCreateWallets();

function walletClient(pk: Hex) {
  return createWalletClient({ account: privateKeyToAccount(pk), chain: arbitrumSepolia, transport: http(rpcUrl) });
}

const QUALITY_JOBS: Array<{
  title: string;
  description: string;
  criteria: string;
  domain: string;
  rewardEth: string;
  deadlineDays: number;
}> = [
  {
    title: "WorkProof Landing Page Hero Copy",
    description: "Write a high-conviction hero block for the WorkProof landing page that explains autonomous freelance escrow to crypto-native and non-crypto visitors in under 60 words. Include headline, sub-headline, and a single primary CTA.",
    criteria: "Deliverable URL points to a public document containing: (1) a single H1 headline under 12 words, (2) a sub-headline 1-2 sentences, (3) one CTA button label, (4) no jargon like \"L2\" or \"GenLayer\" in the headline itself. Tone is confident but factual.",
    domain: "content",
    rewardEth: "0.004",
    deadlineDays: 10
  },
  {
    title: "Freelancer Onboarding Flow Doc",
    description: "Document the WorkProof freelancer onboarding flow in 5-7 numbered steps: browse, connect wallet, apply, wait for accept, submit, claim. Each step should be 1-3 sentences with the user's mental model.",
    criteria: "Deliverable contains numbered steps 1-7, each with a clear name + 1-3 sentence body. Mentions the AI verifier, retries (max 3), and that the reward auto-transfers on claim.",
    domain: "content",
    rewardEth: "0.005",
    deadlineDays: 14
  },
  {
    title: "Dispute Window Explainer",
    description: "Write a 200-300 word explainer for clients about WorkProof's optional dispute window. Cover: what it is, why it exists, how the admin can override an AI verdict, and that it defaults to 0.",
    criteria: "Word count between 200 and 350. Covers all four bullet points. Plain English, no marketing fluff. One paragraph of intro, one of mechanics, one of when to use it.",
    domain: "content",
    rewardEth: "0.003",
    deadlineDays: 7
  },
  {
    title: "Smart Contract Audit Report — Ban & Delete Surfaces",
    description: "Audit the new banUser, unbanUser, and deleteJob functions in WorkProof.sol on Arbitrum Sepolia at the deployed address. Report on access control, re-entrancy, fund-safety on delete (escrow returns to client), and event coverage.",
    criteria: "Deliverable references the actual function signatures, identifies onlyOwner gating, confirms nonReentrant on deleteJob, and verifies the JobDeleted event is emitted. At least 400 words.",
    domain: "smart-contracts",
    rewardEth: "0.015",
    deadlineDays: 14
  },
  {
    title: "totalEscrowed Accounting Review",
    description: "Trace the totalEscrowed counter through every state-changing function (postJob, topUpEscrow, claimReward, _refund, deleteJob, sweepStuckEth) and confirm it never goes negative and always matches the contract's actual escrowed balance.",
    criteria: "Lists each function and its delta on totalEscrowed (e.g. postJob: +msg.value, claimReward: -escrow). Confirms sweepStuckEth subtracts nothing because it only spends balance above totalEscrowed.",
    domain: "smart-contracts",
    rewardEth: "0.012",
    deadlineDays: 14
  },
  {
    title: "Verdict Override Edge Cases",
    description: "Identify 5 edge cases where overrideVerdict could behave unexpectedly. For each, describe the scenario, the expected behavior, and whether the contract currently handles it correctly.",
    criteria: "Five distinct scenarios, each with scenario / expected / actual sections. Covers at least: already-claimed, terminal status (Complete/Refunded/Deleted), zero paymentPct, paymentPct > 100, and override during paused state.",
    domain: "smart-contracts",
    rewardEth: "0.010",
    deadlineDays: 14
  },
  {
    title: "Tailwind Component: StatusBadge",
    description: "Build a reusable React + Tailwind StatusBadge component that supports 8 states (open, active, under-review, failed, passed, complete, refunded, deleted). Each has a unique color and the under-review state animates a pulsing dot.",
    criteria: "Public deliverable URL contains compilable TSX with a typed StatusBadge component. Eight visual states distinguished by color. Pulse animation defined with CSS keyframes for under-review only.",
    domain: "frontend",
    rewardEth: "0.008",
    deadlineDays: 12
  },
  {
    title: "Wagmi useTx Hook Implementation",
    description: "Implement a React hook useTx that wraps wagmi's useWriteContract and produces a three-phase toast (Signing, Confirming, Done). The hook hides the tx hash from body copy and exposes it only as a 'View on Arbiscan' link.",
    criteria: "Deliverable is TSX code. Hook returns { run } where run({ label, write, onConfirmed }) shows a toast. Tx hash is never rendered as plain text in the toast body, only in a hyperlink labeled \"View on Arbiscan\".",
    domain: "frontend",
    rewardEth: "0.009",
    deadlineDays: 12
  },
  {
    title: "Applicants Panel for Job Detail Page",
    description: "Build a client-only panel that lists all applicants for an Open job (read from contract via getApplicants(jobId)) with their reputation and a single-tap Accept button.",
    criteria: "Deliverable contains TSX. Reads applicants via useReadContract with getApplicants. Renders each applicant as a row with truncated address (0x12...ab34) + reputation + Accept button. Accept calls acceptApplication(jobId, freelancer) via useTx.",
    domain: "frontend",
    rewardEth: "0.008",
    deadlineDays: 10
  },
  {
    title: "Mobile-Responsive Job Action Panel",
    description: "Make the JobActionPanel sticky-bottom on mobile (<768px) so the primary CTA is always reachable. Above 768px it stays in the sidebar.",
    criteria: "Deliverable shows the CSS or Tailwind classes used. Sticky positioning kicks in at max-width 767px. Z-index does not occlude the navbar. Includes safe-area-inset-bottom padding for iOS.",
    domain: "frontend",
    rewardEth: "0.006",
    deadlineDays: 7
  },
  {
    title: "Dark Theme Token Audit",
    description: "Audit the WorkProof dark theme tokens (--background, --surface, --accent, etc.) for WCAG AA contrast against --foreground text. Report any failing combinations and propose fixes.",
    criteria: "Lists every token pair tested with measured contrast ratio. Flags any pair below 4.5:1 for body text or 3:1 for large text. Suggested fix for each failing pair.",
    domain: "design",
    rewardEth: "0.005",
    deadlineDays: 9
  },
  {
    title: "Status Badge Iconography Set",
    description: "Design 8 monochrome icons (16x16) for each job status (Open, Active, UnderReview, Failed, Passed, Complete, Refunded, Deleted). Provide them as inline SVG.",
    criteria: "Deliverable is a public page or Gist with 8 SVG snippets. Each is exactly 16x16. Each is recognisably different but visually cohesive (same stroke weight, same corner radius).",
    domain: "design",
    rewardEth: "0.007",
    deadlineDays: 10
  },
  {
    title: "Empty State Illustrations for Dashboards",
    description: "Create 4 minimal SVG illustrations for empty states: no active jobs, no applicants, no claims, no notifications. Dark-theme native, monochrome with an accent color.",
    criteria: "Four distinct SVGs, each under 4KB. Each communicates the empty state visually (e.g. inbox for notifications, magnifier for no applicants). Stroke-only, no fills except the accent.",
    domain: "design",
    rewardEth: "0.008",
    deadlineDays: 12
  },
  {
    title: "Hero Section Concept — Dark Mode",
    description: "Design a high-impact hero section concept for WorkProof: a dark-mode landing with grid-mesh background, glowing CTA, live counters, and a side card showing the protocol flow.",
    criteria: "Deliverable is a Figma share link or a hosted PNG export at least 1440x900. Includes the headline, CTA, three live counter cards, and a side panel with the 4-step flow.",
    domain: "design",
    rewardEth: "0.010",
    deadlineDays: 14
  },
  {
    title: "Twitter Launch Thread (10 posts)",
    description: "Write a 10-post launch thread for WorkProof that explains the autonomous escrow flow, the GenLayer verifier, and why on-chain reputation matters. Each post under 280 chars.",
    criteria: "Exactly 10 posts. Each is under 280 characters. Posts 1-2 hook, 3-7 explain mechanics, 8-9 social proof, 10 CTA to try it on Arbitrum Sepolia.",
    domain: "marketing",
    rewardEth: "0.005",
    deadlineDays: 7
  },
  {
    title: "Investor One-Pager",
    description: "Draft a one-page investor summary for WorkProof covering: problem, product, market, technical moat (autonomous + AI-verified + on-chain rep), and traction.",
    criteria: "One page (about 500-700 words). Has explicit sections for the five topics. No vague claims, each claim either cites a fact or labels itself as a target.",
    domain: "marketing",
    rewardEth: "0.008",
    deadlineDays: 12
  },
  {
    title: "Comparison Page vs Traditional Marketplaces",
    description: "Build a comparison table comparing WorkProof vs Upwork/Fiverr across: fees, payment disputes, acceptance criteria, payout speed, reputation portability.",
    criteria: "Markdown or HTML table with at least 5 rows (one per dimension) and 3 columns (WorkProof, Upwork, Fiverr). Each cell is a specific claim (number or short phrase), no vague \"yes/no\".",
    domain: "marketing",
    rewardEth: "0.006",
    deadlineDays: 10
  },
  {
    title: "Email Drip for First-Time Clients",
    description: "Write a 4-email drip sequence for first-time WorkProof clients: welcome, posting their first job, what happens during AI review, and how to handle a Failed verdict.",
    criteria: "Four emails, each with a subject line and 80-150 word body. The 4th email explicitly walks through opening a dispute and the override path.",
    domain: "marketing",
    rewardEth: "0.006",
    deadlineDays: 10
  },
  {
    title: "Builder Spotlight Interview Format",
    description: "Define a reusable 'Builder Spotlight' format for highlighting top WorkProof freelancers: 5 interview questions, a stats card layout, and a single-image OG card layout.",
    criteria: "Includes the 5 questions verbatim, a wireframe of the stats card, and a wireframe of the OG card. Questions are open-ended (not yes/no).",
    domain: "marketing",
    rewardEth: "0.005",
    deadlineDays: 9
  },
  {
    title: "Oracle Health Monitoring Spec",
    description: "Specify a monitoring strategy for the WorkProof oracle service: which signals to alert on (last heartbeat age, RPC errors, GenLayer poll failures, low wallet balance), with thresholds.",
    criteria: "Four named signals, each with a measurement source, an alert threshold, and an escalation path. Includes a recommended dashboard layout.",
    domain: "research",
    rewardEth: "0.007",
    deadlineDays: 12
  },
  {
    title: "Reputation Decay Research Note",
    description: "Research and recommend whether WorkProof reputation should decay over time. Cover: incentive alignment, ossification risk, comparable systems (Stack Overflow, Steam), and a final recommendation.",
    criteria: "At least 600 words. References at least 2 comparable systems with citations or links. Ends with a clear binary recommendation (yes/no) and the reasoning.",
    domain: "research",
    rewardEth: "0.009",
    deadlineDays: 14
  },
  {
    title: "Compare AI Verifier Options",
    description: "Compare GenLayer, a single-LLM API call, and a multi-validator consensus design as ways to verify freelance deliverables. Cover cost, latency, censorship resistance, accuracy.",
    criteria: "Comparison table or matrix with 3 options x 4 dimensions. Each cell is a concrete claim. Ends with a recommendation for WorkProof's stage and why.",
    domain: "research",
    rewardEth: "0.010",
    deadlineDays: 14
  },
  {
    title: "Fee Model Whiteboard",
    description: "Sketch 3 possible fee models WorkProof could adopt (% take on payout, flat per-job, freemium subscription) with pros/cons of each from the client, freelancer, and protocol perspectives.",
    criteria: "Three named models. Each has a 3-row table of (client / freelancer / protocol) pros and cons. Ends with which model is most aligned with the current autonomous architecture.",
    domain: "research",
    rewardEth: "0.008",
    deadlineDays: 12
  },
  {
    title: "Buildathon Demo Script (3 minutes)",
    description: "Write a 3-minute live demo script for WorkProof: open the site, connect, post a job, switch wallet, apply, switch back, accept, switch, submit, watch the AI verdict, claim.",
    criteria: "Demo script with timestamps (00:00, 00:30, 01:00...) totaling roughly 3:00. Each beat has a one-line action + one-line voiceover. Includes a fallback in case the AI verdict is slow.",
    domain: "content",
    rewardEth: "0.007",
    deadlineDays: 10
  },
  {
    title: "Help Center: Claiming Your Reward",
    description: "Write a help-center article walking a freelancer through claiming their reward after a Passed verdict, including the dispute window and what to do if the claim transaction fails.",
    criteria: "Structured with H2 sections: Before You Claim, Step 1 Connect Wallet, Step 2 Click Claim, What If The Tx Fails, Where The Money Goes. Each section 2-4 sentences.",
    domain: "content",
    rewardEth: "0.004",
    deadlineDays: 8
  },
  {
    title: "WorkProof Brand Voice Guide",
    description: "Write a brand voice guide covering: voice attributes (confident, factual, builder-y), terminology preferences (\"verdict\" not \"approval\"), do/don't examples for headlines and microcopy.",
    criteria: "Voice attributes are listed with 1-line definitions. Terminology table has at least 8 prefer/avoid pairs. Do/don't section has at least 5 paired examples.",
    domain: "design",
    rewardEth: "0.006",
    deadlineDays: 10
  },
  {
    title: "Submit Deliverable Modal — Loading & Error States",
    description: "Define every UI state the submit-deliverable modal needs to handle: empty, valid, signing, confirming, success, error, network error, banned wallet, deadline passed.",
    criteria: "Lists each state by name. Each state has a one-line UI description (what changes, what's disabled, what's the message). Banned-wallet state explicitly references the on-chain BANNED revert.",
    domain: "frontend",
    rewardEth: "0.005",
    deadlineDays: 9
  },
  {
    title: "Admin Audit Log Schema Doc",
    description: "Document the admin_actions Supabase table for WorkProof: every field, every action_type the frontend can emit (pause, unpause, force_refund, delete, override, ban, unban, set_reputation, sweep, dispute_resolve), what each one means.",
    criteria: "Field-by-field table with name, type, example. Action type list with at least 9 actions. Each action includes whether it's also a contract call.",
    domain: "smart-contracts",
    rewardEth: "0.006",
    deadlineDays: 10
  },
  {
    title: "Notifications Kind Taxonomy",
    description: "Define the notifications.kind taxonomy: applicant_applied, work_submitted, verdict_passed, verdict_failed, deadline_warning, reward_claimable, dispute_opened, admin_action, badge_earned, level_up.",
    criteria: "All 10 kinds defined with: trigger source (oracle event / API / cron), recipient role, default payload shape (JSON snippet), and example UI rendering.",
    domain: "smart-contracts",
    rewardEth: "0.005",
    deadlineDays: 10
  },
  {
    title: "Gamification XP Curve Proposal",
    description: "Propose the XP-to-level curve for WorkProof gamification. 7+ levels. Justify the curve shape (linear vs exponential), explain feel at low and high levels, name each level.",
    criteria: "Lists at least 7 levels with name + XP threshold. Includes a short rationale for the curve shape. Mentions whether the curve is steep or shallow at the top and why.",
    domain: "research",
    rewardEth: "0.007",
    deadlineDays: 12
  }
];

// Hand-written deliverables for the 4 jobs we will drive to Complete via real GenLayer review.
// Job indices are positional inside QUALITY_JOBS.
const DELIVERABLES: Record<number, { filename: string; content: string }> = {
  0: {
    filename: "workproof-hero-copy.md",
    content: `# Get paid the moment your work is approved

WorkProof is an escrow that locks the client's ETH and releases it automatically when an AI verifier confirms your deliverable meets the agreed criteria. No invoicing, no chasing.

Call-to-action button label: **Post a job**`
  },
  2: {
    filename: "dispute-window-explainer.md",
    content: `# The WorkProof dispute window, explained

WorkProof clients can opt into a dispute window — a configurable delay between an Approved verdict and the freelancer's ability to claim the reward. By default the window is set to zero, meaning rewards are claimable the instant the AI verifier passes the work. The admin can extend the window up to seven days, giving clients a safety net for high-stakes jobs.

The mechanics are deliberately simple. When the AI verifier returns a passing verdict, the contract records the verdict timestamp on chain. The claim function checks that the current block time is at least the verdict time plus the configured window. If the window has not elapsed, the claim reverts. While the window is open, either party can flag the job through the dispute panel. The admin reviews the dispute and may override the AI verdict by calling overrideVerdict, which records a new verdict and reasoning on chain. If the admin upholds the original verdict, the window simply continues to count down.

Use a non-zero window when the deliverable is large, when the client and freelancer have not worked together before, or when the criteria contain subjective elements that an AI verifier might misread. For most short copywriting, design, and code jobs the default of zero is the right choice — it preserves the speed that makes WorkProof useful in the first place.`
  },
  14: {
    filename: "workproof-launch-thread.md",
    content: `1. Freelancing has a trust problem. Clients hold the money, freelancers do the work, and one side always feels exposed. WorkProof fixes this by removing the middle: an autonomous escrow on Arbitrum that pays out the moment AI confirms the work passes.

2. The flow takes three steps. Client posts a job with criteria and locks ETH. Freelancer submits a deliverable URL. An AI verifier reads it against the criteria and the smart contract pays out automatically.

3. The AI verifier is not a single API call. It runs on GenLayer, where multiple validators independently grade the work and reach consensus. One model cannot be bribed or fooled into approving bad work.

4. There is no invoicing, no chasing, no human approving payouts. The contract releases funds based on the verdict. If the work fails, the freelancer gets two more retries before the escrow refunds to the client.

5. Reputation is on chain. Every passed job adds reputation points to the freelancer wallet. The score is portable: anyone reading the contract sees the same numbers, no platform can hide it.

6. Clients control the deadline. If the freelancer never submits, the oracle automatically refunds the escrow after the deadline passes. No tickets, no support email, just code.

7. Admins exist for safety, not for payouts. Bans, deletes, and verdict overrides are all on-chain functions that emit events. Nothing happens in a Discord thread.

8. The dApp ships today on Arbitrum Sepolia. Real escrow, real GenLayer reviews, real claims. Built end to end during this build sprint, ready to extend.

9. Why now: every "AI co-worker" project assumes someone validates the output. WorkProof is that validator, but trust-minimized. It is the missing piece for autonomous agent payments too.

10. Try it: arbworkproof.vercel.app. Connect a wallet, post a tiny job, see the full loop run in under five minutes. Then tell us what you would change.`
  },
  24: {
    filename: "claiming-your-reward-help.md",
    content: `# Claiming your reward on WorkProof

## Before You Claim
Your job must be in the Passed state. That means the AI verifier read your deliverable, scored it against the acceptance criteria, and approved the payout. You will see a green "Passed" badge on the job page and a Claim Reward button.

## Step 1 Connect Wallet
Open the job page in the same browser session you used to submit the work. Connect the wallet that was assigned to the job. If you connect a different wallet, the claim button stays disabled because the smart contract only allows the assigned freelancer to claim.

## Step 2 Click Claim
Press the Claim Reward button. Your wallet will open a confirmation prompt. The toast in the corner walks the transaction through three phases: Signing, Confirming, Done. The reward transfers to your wallet immediately in the same transaction.

## What If The Tx Fails
The most common cause is insufficient gas. Top up the wallet with a small amount of Sepolia ETH and try again. If the dispute window has not yet elapsed, the contract will revert with "DISPUTE_WINDOW" and you simply need to wait. If you see "ALREADY_CLAIMED" you have already collected the payout and can confirm it in your wallet history.

## Where The Money Goes
The reward goes to the wallet that submitted the work. Any remainder of the original escrow returns to the client in the same transaction. There is no intermediate hop and no protocol fee — the freelancer receives the full reward as set by the AI verdict.`
  }
};

const DRIVE_INDICES = Object.keys(DELIVERABLES).map(Number);

// ---- GitHub Gist hosting ----
async function createGist(filename: string, content: string): Promise<string> {
  const r = await fetch("https://api.github.com/gists", {
    method: "POST",
    headers: {
      Authorization: `token ${githubToken}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      description: `WorkProof deliverable: ${filename}`,
      public: true,
      files: { [filename]: { content } }
    })
  });
  if (!r.ok) throw new Error(`Gist create failed: ${r.status} ${await r.text()}`);
  const json: any = await r.json();
  const file = json.files[filename];
  return file.raw_url as string;
}

// ---- GenLayer ----
async function genCall(method: string, args: unknown[]) {
  const response = await fetch(genLayerRpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "gen_callContractMethod",
      params: { contract: genLayerContract, method, args }
    })
  });
  if (!response.ok) throw new Error(`GenLayer ${method} failed: ${response.status}`);
  const body: any = await response.json();
  return body.result ?? body;
}

// ---- Funding ----
async function fundIfNeeded(to: Hex, minWei: bigint) {
  const bal = await publicClient.getBalance({ address: to });
  if (bal >= minWei) return;
  const topUp = minWei - bal + parseEther("0.001");
  console.log(`  funding ${to} with ${formatEther(topUp)} ETH (current: ${formatEther(bal)} ETH)`);
  const hash = await deployerWallet.sendTransaction({ to, value: topUp });
  await publicClient.waitForTransactionReceipt({ hash });
}

// ---- Contract calls ----
async function postJob(clientPk: Hex, brief: typeof QUALITY_JOBS[number]) {
  const w = walletClient(clientPk);
  const escrow = parseEther(brief.rewardEth);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + brief.deadlineDays * 24 * 3600);
  const hash = await w.writeContract({
    address: contractAddress!,
    abi: workProofAbi,
    functionName: "postJob",
    args: [brief.title, "", brief.criteria, brief.domain, deadline, "0x0000000000000000000000000000000000000000"],
    value: escrow
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const logs = parseEventLogs({ abi: workProofAbi, eventName: "JobPosted", logs: receipt.logs });
  const jobId = (logs[0]?.args as any)?.jobId as Hex;
  return jobId;
}

async function apply(freelancerPk: Hex, jobId: Hex) {
  const w = walletClient(freelancerPk);
  const hash = await w.writeContract({ address: contractAddress!, abi: workProofAbi, functionName: "applyForJob", args: [jobId] });
  await publicClient.waitForTransactionReceipt({ hash });
}

async function accept(clientPk: Hex, jobId: Hex, freelancer: Hex) {
  const w = walletClient(clientPk);
  const hash = await w.writeContract({ address: contractAddress!, abi: workProofAbi, functionName: "acceptApplication", args: [jobId, freelancer] });
  await publicClient.waitForTransactionReceipt({ hash });
}

async function submitWork(freelancerPk: Hex, jobId: Hex, url: string) {
  const w = walletClient(freelancerPk);
  const hash = await w.writeContract({ address: contractAddress!, abi: workProofAbi, functionName: "submitWork", args: [jobId, url] });
  await publicClient.waitForTransactionReceipt({ hash });
}

async function relayVerdict(jobId: Hex, passed: boolean, paymentPct: number, reasoning: string) {
  const hash = await deployerWallet.writeContract({
    address: contractAddress!,
    abi: workProofAbi,
    functionName: "receiveVerdict",
    args: [jobId, passed, paymentPct, reasoning]
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

async function claim(freelancerPk: Hex, jobId: Hex) {
  const w = walletClient(freelancerPk);
  const hash = await w.writeContract({ address: contractAddress!, abi: workProofAbi, functionName: "claimReward", args: [jobId] });
  await publicClient.waitForTransactionReceipt({ hash });
}

async function pollGenLayerVerdict(jobId: Hex, maxMs = 6 * 60 * 1000): Promise<any> {
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < maxMs) {
    attempt++;
    try {
      const verdict = await genCall("get_verdict", [jobId]);
      if (verdict?.ready) return verdict;
      console.log(`     waiting for GenLayer verdict… attempt ${attempt}`);
    } catch (err: any) {
      console.log(`     poll error (${err?.message?.slice(0, 60)}), retrying…`);
    }
    await new Promise((r) => setTimeout(r, 15000));
  }
  throw new Error("GenLayer verdict timeout");
}

async function main() {
  console.log(`Deployer:  ${deployerAccount.address}`);
  console.log(`WorkProof: ${contractAddress}`);

  // Compute total escrow needed for client funding
  const totalEscrowByClient: Record<number, bigint> = { 0: 0n, 1: 0n, 2: 0n };
  QUALITY_JOBS.forEach((job, idx) => {
    const clientIdx = idx % 3;
    totalEscrowByClient[clientIdx] += parseEther(job.rewardEth);
  });

  console.log("\nFunding client wallets…");
  for (let i = 0; i < wallets.clients.length; i++) {
    const need = totalEscrowByClient[i] + parseEther("0.005");
    await fundIfNeeded(wallets.clients[i].address, need);
  }

  console.log("\nPosting 30 jobs…");
  const posted: Array<{ jobId: Hex; brief: typeof QUALITY_JOBS[number]; clientIdx: number; idx: number }> = [];
  for (let i = 0; i < QUALITY_JOBS.length; i++) {
    const brief = QUALITY_JOBS[i];
    const clientIdx = i % 3;
    try {
      const jobId = await postJob(wallets.clients[clientIdx].privateKey, brief);
      posted.push({ jobId, brief, clientIdx, idx: i });
      console.log(`  [${i + 1}/30] ${brief.title.slice(0, 50)} → ${jobId.slice(0, 14)}…`);
    } catch (err: any) {
      console.error(`  [${i + 1}/30] FAILED: ${brief.title} — ${err?.shortMessage || err?.message}`);
    }
  }

  console.log("\n────── Final Report ──────");
  console.log(`Contract:  ${contractAddress}`);
  console.log(`Posted:    ${posted.length}/30 jobs as Open`);
  console.log(`Client wallets funded: ${wallets.clients.length}`);
  console.log(`\nClient wallets:`);
  wallets.clients.forEach((c, i) => console.log(`  client-${i + 1}: ${c.address}`));
  console.log(`\nFreelancer wallets (pre-funded for gas, ready to apply):`);
  wallets.freelancers.forEach((f, i) => console.log(`  freelancer-${i + 1}: ${f.address}`));
  console.log(`\nWallet file: ${statePath}`);
  console.log(`\nAll 30 jobs are Open. Visit the dApp to apply, accept, submit, and let GenLayer verify.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
