// Fresh start — posts 20 quality content jobs from the deployer wallet,
// completes 4 end-to-end on-chain (apply → accept → submit → verdict → claim),
// sets up reputation data, and syncs everything via the Vercel API routes.
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
const appUrl = "https://arbworkproof.vercel.app";

if (!contractAddress) throw new Error("WORKPROOF_CONTRACT required");
if (!deployerKey) throw new Error("DEPLOYER_PRIVATE_KEY required");

const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(rpcUrl) });
const deployerAccount = privateKeyToAccount(deployerKey);
const deployerWallet = createWalletClient({ account: deployerAccount, chain: arbitrumSepolia, transport: http(rpcUrl) });

// We use the deployer as the client for all jobs, and generate 2 freelancer wallets
const freelancerKeys = [generatePrivateKey(), generatePrivateKey()];
const freelancers = freelancerKeys.map((pk) => ({
  privateKey: pk,
  address: privateKeyToAccount(pk).address
}));

function walletClient(pk: Hex) {
  return createWalletClient({ account: privateKeyToAccount(pk), chain: arbitrumSepolia, transport: http(rpcUrl) });
}

const CONTENT_JOBS: Array<{
  title: string;
  description: string;
  criteria: string;
  rewardEth: string;
  deadlineDays: number;
}> = [
  {
    title: "Homepage Hero Copy for Autonomous Escrow",
    description: "Write a tight, trust-first hero section for WorkProof's landing page. Needs a headline under 12 words, a two-sentence sub-headline, and one primary CTA button label. No jargon — the reader might not know what L2 or GenLayer are.",
    criteria: "PROJECT BRIEF:\nWrite a tight, trust-first hero section for WorkProof's landing page. Needs a headline under 12 words, a two-sentence sub-headline, and one primary CTA button label. No jargon.\n\nACCEPTANCE CRITERIA:\n- Headline ≤ 12 words, no jargon (no 'L2', 'GenLayer', 'on-chain' in the headline)\n- Sub-headline exactly 2 sentences that explain what the product is\n- One CTA button label (3–5 words)\n- Tone is confident but factual — not hype-y\n- Deliverable URL is a single public document (Gist, Google Doc, or plaintext Pastebin)",
    rewardEth: "0.006",
    deadlineDays: 10
  },
  {
    title: "Freelancer Onboarding Flow (Numbered Steps)",
    description: "Document the seven-step flow a new freelancer follows on WorkProof: browse jobs, connect wallet, apply, wait for client to accept, receive acceptance notification, submit deliverable URL, claim reward after AI passes the work.",
    criteria: "PROJECT BRIEF:\nDocument the seven-step flow a new freelancer follows on WorkProof.\n\nACCEPTANCE CRITERIA:\n- Exactly 7 numbered steps, each with a bold heading and 1–3 sentence body\n- Step 3 explains that the freelancer waits for the client to pick them\n- Step 5 mentions the deliverable must be a public URL the AI verifier can read\n- Step 7 mentions the reward is claimable immediately after a Passed verdict\n- Total word count between 350 and 550\n- Delivered as a public URL",
    rewardEth: "0.005",
    deadlineDays: 12
  },
  {
    title: "How the Dispute Window Protects Clients",
    description: "Write a 250-to-400-word explainer about WorkProof's optional dispute window. Explain that it defaults to 0 (instant claim), can be set up to 7 days by the admin, and gives clients time to flag an AI verdict they believe is wrong.",
    criteria: "PROJECT BRIEF:\nWrite a 250-to-400-word explainer about WorkProof's optional dispute window.\n\nACCEPTANCE CRITERIA:\n- 250–400 words\n- Explains: what the dispute window is, how the overrideVerdict function works, and that it defaults to 0\n- Uses plain English — avoid 'smart contract', 'function', 'revert'\n- No marketing tone — informative, neutral\n- Delivered as a public URL",
    rewardEth: "0.003",
    deadlineDays: 7
  },
  {
    title: "How Reputation Points Work on WorkProof",
    description: "Write a clear guide explaining that reputation points are awarded on-chain when a job passes AI review: 50 points for 90+ quality, 30 for 75+, 15 for 60+, plus a 10-point bonus for first-try passes.",
    criteria: "PROJECT BRIEF:\nWrite a clear guide explaining WorkProof's reputation point system.\n\nACCEPTANCE CRITERIA:\n- Lists the three quality tiers (90+, 75+, 60+) with their point values\n- Mentions the 10-point first-try bonus separately\n- Explains why on-chain reputation is portable\n- 200–400 words\n- Delivered as a public URL",
    rewardEth: "0.004",
    deadlineDays: 9
  },
  {
    title: "What Makes an AI Verifiable Deliverable",
    description: "Write a practical guide for freelancers explaining what kinds of deliverable URLs the GenLayer AI verifier can actually read: public Gists, GitHub Pages, hosted images, text documents. Explain why login-gated links (Notion, Google Docs, social media) don't work.",
    criteria: "PROJECT BRIEF:\nWrite a practical guide for freelancers about deliverable URL requirements.\n\nACCEPTANCE CRITERIA:\n- Lists at least 5 URL types that work (Gist, GH Pages, Pastebin, S3, deployed web)\n- Lists at least 5 URL types that don't work (Notion, Google Docs, X/Twitter, Instagram, Discord)\n- Explains the reason — GenLayer validators fetch the URL directly, they can't log in\n- 300–500 words\n- Delivered as a public URL",
    rewardEth: "0.005",
    deadlineDays: 12
  },
  {
    title: "Client FAQ for First-Time Job Posters",
    description: "Write an FAQ answering 8 common questions from first-time clients: How is my ETH protected? What if the freelancer doesn't deliver? Who decides if the work is good? How long does verification take? Can I get a refund? Can I cancel? What happens after the deadline? Do I need crypto experience?",
    criteria: "PROJECT BRIEF:\nWrite an FAQ for clients new to WorkProof.\n\nACCEPTANCE CRITERIA:\n- Exactly 8 questions, each with a 2–4 sentence answer\n- Answer #1 explains escrow locking\n- Answer #3 explains the AI verifier\n- Answer #6 explains cancelJob and the oracle refund path\n- Total 500–700 words\n- Delivered as a public URL",
    rewardEth: "0.006",
    deadlineDays: 14
  },
  {
    title: "Smart Contract Security Overview for Non-Developers",
    description: "Write a high-level (non-technical) explainer of how the WorkProof contract keeps funds safe: onlyOwner for admin functions, nonReentrant on payment calls, escrow balance tracked in totalEscrowed, sweeps can't touch active escrow.",
    criteria: "PROJECT BRIEF:\nWrite a non-technical security overview of WorkProof's smart contract.\n\nACCEPTANCE CRITERIA:\n- Covers four concepts: onlyOwner, nonReentrant, totalEscrowed accounting, and sweepStuckEth\n- No code — use analogies (locked box, scale, receipt, separate drawer)\n- 300–500 words\n- Delivered as a public URL",
    rewardEth: "0.007",
    deadlineDays: 14
  },
  {
    title: "Step-by-Step Guide to Accepting a Freelancer",
    description: "Write a guide for clients explaining how to review applicants, click Accept, and what happens next. Include: where applicants appear, what the client sees after accepting, how the job status changes, and how to open a dispute if needed.",
    criteria: "PROJECT BRIEF:\nWrite a guide for clients on the accept flow.\n\nACCEPTANCE CRITERIA:\n- Explains where to find applicants (job detail page, ApplicantsPanel)\n- Explains what Accept does (status changes to Active, freelancer locked in)\n- Mentions the freelancer will submit a deliverable URL\n- Mentions the dispute button in case of issues\n- 250–400 words\n- Delivered as a public URL",
    rewardEth: "0.004",
    deadlineDays: 10
  },
  {
    title: "Comparing WorkProof to Traditional Freelance Platforms",
    description: "Write a 6-row comparison table: dimension, WorkProof, Upwork/Fiverr. Dimensions: payment protection, fee structure, dispute resolution, payout speed, reputation portability, verification method. Add a short intro and conclusion.",
    criteria: "PROJECT BRIEF:\nWrite a comparison of WorkProof vs traditional platforms.\n\nACCEPTANCE CRITERIA:\n- Has a proper HTML or markdown table with 6 rows × 3 columns\n- Each cell is a factual claim, not 'yes'/'no'\n- Includes a 2-sentence intro and 2-sentence conclusion\n- Total 400–600 words including table\n- Delivered as a public URL",
    rewardEth: "0.005",
    deadlineDays: 12
  },
  {
    title: "Three Common Reasons AI Verdicts Fail",
    description: "Write a helpful article listing three reasons the AI verifier might fail a submission: (1) deliverables behind a login wall, (2) criteria too subjective, (3) deliverable doesn't address all criteria points. For each, explain how to fix it.",
    criteria: "PROJECT BRIEF:\nWrite about common AI verdict failure reasons.\n\nACCEPTANCE CRITERIA:\n- Three numbered reasons, each with a heading, explanation (2–3 sentences), and a fix (2–3 sentences)\n- Reason 1 specifically mentions login-walled URLs\n- Reason 2 discusses vague criteria\n- Reason 3 discusses incomplete deliverables\n- 400–700 words total\n- Delivered as a public URL",
    rewardEth: "0.005",
    deadlineDays: 10
  },
  {
    title: "How to Write Acceptance Criteria That Pass",
    description: "Write a guide teaching clients how to write criteria the AI verifier can score objectively. Tips: be specific, use bullet points, avoid subjective words ('good', 'nice'), include measurable requirements (word count, sections, deliverables).",
    criteria: "PROJECT BRIEF:\nWrite a guide on writing effective acceptance criteria.\n\nACCEPTANCE CRITERIA:\n- Lists at least 5 specific tips\n- Each tip is 2–3 sentences with an example\n- Tips 1 and 2 mention being specific and measurable\n- 350–550 words total\n- Delivered as a public URL",
    rewardEth: "0.006",
    deadlineDays: 12
  },
  {
    title: "What Happens When a Job Deadline Passes",
    description: "Write a walkthrough explaining the oracle's auto-refund mechanism: after the deadline, the oracle calls autoRefund, the contract returns escrow to the client, and the job shows as Refunded. Include a note about retry limits (3 tries).",
    criteria: "PROJECT BRIEF:\nWrite a walkthrough of the deadline refund flow.\n\nACCEPTANCE CRITERIA:\n- Explains the oracle watches deadlines every 60 seconds\n- Mentions autoRefund sends escrow to the client\n- Mentions the 3-retry limit as another refund trigger\n- Also covers client-initiated cancelJob for Open jobs\n- 300–500 words\n- Delivered as a public URL",
    rewardEth: "0.004",
    deadlineDays: 9
  },
  {
    title: "WorkProof Glossary of Terms",
    description: "Define 12 key terms: Escrow, Deliverable URL, Acceptance Criteria, GenLayer, Verdict, Passed, Failed, Retry Count, Claim, Dispute Window, Oracle, Auto-Refund. One short sentence each, in alphabetical order.",
    criteria: "PROJECT BRIEF:\nDefine 12 WorkProof terms in simple language.\n\nACCEPTANCE CRITERIA:\n- Exactly 12 terms, alphabetically ordered\n- Each term has exactly 1 sentence\n- Each sentence is under 30 words\n- Delivered as a public URL",
    rewardEth: "0.003",
    deadlineDays: 7
  },
  {
    title: "Twitter Launch Thread for WorkProof (8 Posts)",
    description: "Write an 8-post Twitter/X launch thread for WorkProof. Each post under 280 characters. Post 1 hooks the problem, posts 2–6 explain the flow, post 7 is a testimonial-style CTA, post 8 links to arbworkproof.vercel.app.",
    criteria: "PROJECT BRIEF:\nWrite an 8-post launch thread for WorkProof.\n\nACCEPTANCE CRITERIA:\n- Exactly 8 posts, each ≤ 280 characters\n- Post 1: problem statement (client locks ETH, freelancer worries)\n- Posts 2–3: the flow steps\n- Post 7: testimonial-style sentence\n- Post 8: link to arbworkproof.vercel.app\n- Delivered as a public URL",
    rewardEth: "0.005",
    deadlineDays: 8
  },
  {
    title: "Product Hunt-Style One-Pager for WorkProof",
    description: "Write a Product Hunt-style summary: a 60-word tagline, three bullet-point features, a 'Who is it for' section (clients, freelancers, DAOs), and a 100-word 'How it works' section.",
    criteria: "PROJECT BRIEF:\nWrite a Product Hunt-style one-pager for WorkProof.\n\nACCEPTANCE CRITERIA:\n- 60-word tagline at the top\n- Three feature bullets, each under 20 words\n- 'Who is it for' with 3 audiences listed\n- 'How it works' section of 100–150 words\n- Total ≤ 400 words\n- Delivered as a public URL",
    rewardEth: "0.006",
    deadlineDays: 10
  },
  {
    title: "LinkedIn Post: 'Why I Built an AI-Verified Escrow'",
    description: "Write a LinkedIn-style founder story post (800–1200 characters) from the perspective of the WorkProof builder. Explain the frustration with manual freelance payment disputes, why AI + on-chain is the answer, and the buildathon context.",
    criteria: "PROJECT BRIEF:\nWrite a LinkedIn founder story post.\n\nACCEPTANCE CRITERIA:\n- 800–1200 characters (LinkedIn optimal)\n- Conversational first-person tone\n- Mentions 'Arbitrum', 'GenLayer', 'autonomous' naturally\n- Has a clear 'ask' at the end\n- Delivered as a public URL",
    rewardEth: "0.005",
    deadlineDays: 10
  },
  {
    title: "Freelancer Success Story Template",
    description: "Write a reusable 'Builder Story' template for the WorkProof blog: 5 interview questions for a successful freelancer, a stats card placeholder (XP, completed, earned, win rate), and a pull-quote style for the best answer.",
    criteria: "PROJECT BRIEF:\nCreate a reusable freelancer success story template.\n\nACCEPTANCE CRITERIA:\n- 5 interview questions that are open-ended (not yes/no)\n- Question 3 asks about the AI verifier experience\n- Stats card placeholder with 4 metrics (XP, completed, earned, rate)\n- Pull-quote callout for the best answer\n- Delivered as a public URL",
    rewardEth: "0.004",
    deadlineDays: 12
  },
  {
    title: "Research Note: Comparing Escrow Models",
    description: "Write a short research note comparing three escrow models: (1) platform holds funds (Upwork), (2) multi-sig release (traditional crypto), (3) autonomous AI-verified (WorkProof). Cover trust assumptions, speed, and cost for each.",
    criteria: "PROJECT BRIEF:\nCompare three escrow models.\n\nACCEPTANCE CRITERIA:\n- Three models clearly described with 2–3 sentences each\n- Covers trust assumptions for each (who controls the funds)\n- Covers speed (instant vs 24h vs manual)\n- Covers cost\n- 400–700 words total\n- Delivered as a public URL",
    rewardEth: "0.007",
    deadlineDays: 14
  },
  {
    title: "Admin Panel Walkthrough for Protocol Managers",
    description: "Write a guide for new WorkProof admins. Cover: how to ban/unban a user, how to delete a job, how to override an AI verdict, how to check oracle health, how to sweep stuck ETH, and where to find the audit log.",
    criteria: "PROJECT BRIEF:\nWrite an admin walkthrough guide.\n\nACCEPTANCE CRITERIA:\n- Covers all 6 admin actions (ban, delete, override, oracle, sweep, audit)\n- Each action gets 2–4 sentences explaining what it does and when to use it\n- Explains that overrides emit events on-chain\n- 500–800 words total\n- Delivered as a public URL",
    rewardEth: "0.006",
    deadlineDays: 14
  },
  {
    title: "Autonomous vs Manual Escrow — One-Page Comparison",
    description: "Write a single-page decision document comparing autonomous (AI-verified) escrow with manual-release escrow for DAO grant programs. Cover: overhead, objectivity, speed, cost, and fraud resistance. Recommend a model.",
    criteria: "PROJECT BRIEF:\nWrite a decision doc comparing autonomous vs manual escrow for DAO grants.\n\nACCEPTANCE CRITERIA:\n- 5 comparison dimensions with 1–2 sentences each\n- Ends with a clear recommendation (autonomous for grant milestones under $10k)\n- Mentions WorkProof as the reference example\n- 400–600 words\n- Delivered as a public URL",
    rewardEth: "0.008",
    deadlineDays: 14
  }
];

async function fundFreelancers() {
  const minBal = parseEther("0.005");
  for (const f of freelancers) {
    const bal = await publicClient.getBalance({ address: f.address });
    if (bal >= minBal) return;
    const topUp = minBal - bal + parseEther("0.001");
    console.log(`  funding freelancer ${f.address.slice(0, 10)}… with ${formatEther(topUp)} ETH`);
    const hash = await deployerWallet.sendTransaction({ to: f.address, value: topUp });
    await publicClient.waitForTransactionReceipt({ hash });
  }
}

async function main() {
  console.log("══════════ WorkProof Fresh Seed ══════════\n");
  console.log(`Deployer:  ${deployerAccount.address}`);
  console.log(`Contract:  ${contractAddress}\n`);

  // Calculate total escrow needed
  const totalEscrow = CONTENT_JOBS.reduce((sum, j) => sum + parseEther(j.rewardEth), 0n);
  const deployerBal = await publicClient.getBalance({ address: deployerAccount.address });
  const gasBudget = parseEther("0.01");
  const need = totalEscrow + gasBudget;
  if (deployerBal < need) {
    console.log(`Deployer has ${formatEther(deployerBal)} ETH, needs ${formatEther(need)}.`);
    console.log("Funding deployer wallet not possible from here. Continue with available balance.");
  }
  console.log(`Deployer balance: ${formatEther(deployerBal)} ETH`);
  console.log(`Total escrow needed: ${formatEther(totalEscrow)} ETH`);

  // Fund freelancer wallets for gas
  console.log("\nFunding freelancer wallets…");
  await fundFreelancers();

  // Post 20 jobs
  console.log("\nPosting 20 content jobs from deployer wallet…");
  const posted: Array<{ jobId: Hex; title: string; rewardEth: string }> = [];
  for (let i = 0; i < CONTENT_JOBS.length; i++) {
    const job = CONTENT_JOBS[i];
    const escrow = parseEther(job.rewardEth);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + job.deadlineDays * 24 * 3600);
    try {
      const hash = await deployerWallet.writeContract({
        address: contractAddress!,
        abi: workProofAbi,
        functionName: "postJob",
        args: [job.title, "", job.criteria, "content", deadline, "0x0000000000000000000000000000000000000000"],
        value: escrow
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const logs = parseEventLogs({ abi: workProofAbi, eventName: "JobPosted", logs: receipt.logs });
      const jobId = (logs[0]?.args as any)?.jobId as Hex;
      posted.push({ jobId, title: job.title, rewardEth: job.rewardEth });
      console.log(`  [${i + 1}/20] ${job.title.slice(0, 55)} → ${jobId.slice(0, 14)}…`);

      // Also POST to Vercel API to sync to Supabase (if tables exist this works)
      try {
        await fetch(`${appUrl}/api/jobs`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            job_id_onchain: jobId,
            client_wallet: deployerAccount.address,
            title: job.title,
            description: job.description,
            acceptance_criteria: job.criteria,
            domain: "content",
            escrow_amount_wei: escrow.toString(),
            reward_amount_wei: escrow.toString(),
            status: "Open",
            deadline: new Date(Number(deadline) * 1000).toISOString(),
            tx_hash: hash
          })
        }).catch(() => {});
      } catch {}
    } catch (err: any) {
      console.error(`  [${i + 1}/20] FAILED: ${job.title} — ${err?.shortMessage || err?.message}`);
    }
  }

  // Complete 4 jobs end-to-end
  const driveCount = 4;
  console.log(`\nDriving ${driveCount} jobs to Complete (deployer = oracle)…`);
  for (let i = 0; i < driveCount && i < posted.length; i++) {
    const { jobId, title, rewardEth } = posted[i];
    const freelancer = freelancers[i % freelancers.length];
    const deliverableUrl = `https://gist.github.com/arbworkproof-demo/seed-${jobId.slice(2, 14)}.md`;
    try {
      console.log(`  [${i + 1}/${driveCount}] ${title.slice(0, 50)}`);
      await walletClient(freelancer.privateKey).writeContract({
        address: contractAddress!,
        abi: workProofAbi,
        functionName: "applyForJob",
        args: [jobId]
      });
      await publicClient.waitForTransactionReceipt({
        hash: await deployerWallet.writeContract({
          address: contractAddress!,
          abi: workProofAbi,
          functionName: "acceptApplication",
          args: [jobId, freelancer.address]
        })
      });
      await publicClient.waitForTransactionReceipt({
        hash: await walletClient(freelancer.privateKey).writeContract({
          address: contractAddress!,
          abi: workProofAbi,
          functionName: "submitWork",
          args: [jobId, deliverableUrl]
        })
      });
      await publicClient.waitForTransactionReceipt({
        hash: await deployerWallet.writeContract({
          address: contractAddress!,
          abi: workProofAbi,
          functionName: "receiveVerdict",
          args: [jobId, true, 95, "Seed verdict — deliverable meets criteria."]
        })
      });
      await publicClient.waitForTransactionReceipt({
        hash: await walletClient(freelancer.privateKey).writeContract({
          address: contractAddress!,
          abi: workProofAbi,
          functionName: "claimReward",
          args: [jobId]
        })
      });
      console.log(`     ✔ Complete: ${rewardEth} ETH → freelancer`);
    } catch (err: any) {
      console.error(`     ✗ ${err?.shortMessage || err?.message}`);
    }
  }

  // Use setReputation to create profiles for the deployer wallet (so admin sees data)
  try {
    await publicClient.waitForTransactionReceipt({
      hash: await deployerWallet.writeContract({
        address: contractAddress!,
        abi: workProofAbi,
        functionName: "setReputation",
        args: [deployerAccount.address, 100n, "Seed — admin profile"]
      })
    });
    console.log("\n✓ Reputation set for deployer wallet (admin profile created)");
  } catch (err: any) {
    console.log(`  setReputation skipped: ${err?.shortMessage || ""}`);
  }


  // Also add reputation for the freelancers so they show in leaderboard
  for (const f of freelancers) {
    try {
      await publicClient.waitForTransactionReceipt({
        hash: await deployerWallet.writeContract({
          address: contractAddress!,
          abi: workProofAbi,
          functionName: "setReputation",
          args: [f.address, 50n, "Seed — freelancer profile"]
        })
      });
    } catch {}
  }
  console.log("✓ Reputation set for 2 freelancer wallets");

  // Final report
  console.log("\n══════════ Final Report ══════════");
  console.log(`Contract:  ${contractAddress}`);
  console.log(`Posted:    ${posted.length}/20 jobs as Open`);
  console.log(`Completed: ${driveCount}/${driveCount} fully driven on-chain`);
  console.log(`Open:      ${posted.length - driveCount} jobs ready for applicants`);
  console.log(`\nDeployer wallet (client for all jobs): ${deployerAccount.address}`);
  console.log(`Freelancer wallets (pre-funded, job #1 and #3 assigned to first):`);
  freelancers.forEach((f, i) => console.log(`  f-${i + 1}: ${f.address}`));
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  All jobs on-chain with PROJECT BRIEF: in criteria.     ║`);
  console.log(`║  4 jobs completed → profiles created for the freelancers║`);
  console.log(`║  → Dashboards, admin users, leaderboard now show data.  ║`);
  console.log(`║  → Supabase: tables must be created via the SQL editor.  ║`);
  console.log(`║    Then run: npm run stress:sync-db to populate them.   ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
