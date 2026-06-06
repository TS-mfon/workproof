import "dotenv/config";
import { createPublicClient, createWalletClient, http, parseEther, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";

const rpc = process.env.ARBITRUM_SEPOLIA_RPC ?? "https://sepolia-rollup.arbitrum.io/rpc";
const key = process.env.DEPLOYER_PRIVATE_KEY as Hex;
const v2 = "0xA6E94A8e04fbE69aE485E494012a7f2b615979ea" as const;
const v3 = (process.env.WORKPROOF_CONTRACT ?? "0xA2BD5625E382eB759379681C69f319501b7BA7F1") as `0x${string}`;
if (!key) throw new Error("DEPLOYER_PRIVATE_KEY is required");

const account = privateKeyToAccount(key);
const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(rpc) });
const wallet = createWalletClient({ chain: arbitrumSepolia, transport: http(rpc), account });

const jobComponents = [
  { name: "jobId", type: "bytes32" },
  { name: "client", type: "address" },
  { name: "assignedFreelancer", type: "address" },
  { name: "escrowAmount", type: "uint256" },
  { name: "rewardAmount", type: "uint256" },
  { name: "title", type: "string" },
  { name: "specIpfsHash", type: "string" },
  { name: "acceptanceCriteria", type: "string" },
  { name: "domain", type: "string" },
  { name: "deliverableUrl", type: "string" },
  { name: "status", type: "uint8" },
  { name: "createdAt", type: "uint256" },
  { name: "deadline", type: "uint256" },
  { name: "retryCount", type: "uint256" },
  { name: "genLayerJobId", type: "bytes32" },
  { name: "verdictAt", type: "uint256" }
] as const;

const abi = [
  { type: "function", name: "getJobIds", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32[]" }] },
  { type: "function", name: "getJob", stateMutability: "view", inputs: [{ type: "bytes32" }], outputs: [{ type: "tuple", components: jobComponents }] },
  { type: "function", name: "deleteJob", stateMutability: "nonpayable", inputs: [{ type: "bytes32" }, { type: "string" }], outputs: [] },
  { type: "function", name: "postJobV3", stateMutability: "payable", inputs: [
    { type: "string" }, { type: "string" }, { type: "string" }, { type: "string" }, { type: "uint256" }, { type: "address" }, { type: "uint8" }
  ], outputs: [{ type: "bytes32" }] }
] as const;

const jobs = [
  ["Homepage Value Proposition Rewrite", "Rewrite WorkProof's homepage value proposition for clients and freelancers who do not understand blockchain.", "Deliver one public document containing: a headline under 10 words; a two-sentence subheading; three benefit bullets for clients; three benefit bullets for freelancers; and one CTA. Avoid the words revolutionary, seamless, and game-changing. Total length 180-260 words."],
  ["Freelancer Getting Started Guide", "Create a practical onboarding guide that takes a new freelancer from wallet connection to claiming their first reward.", "Deliver a 700-1000 word public guide with exactly seven numbered steps. Cover browsing, competitive submissions, public deliverable URLs, GenLayer wallet signing, verdict scores, client approval, and claiming. Include a troubleshooting section with at least four problems and solutions."],
  ["Client Guide to Strong Acceptance Criteria", "Teach clients how to write criteria that GenLayer validators can evaluate consistently.", "Deliver an 800-1100 word public guide. Include five bad criteria rewritten into measurable criteria, a reusable checklist, three examples for writing jobs, and three examples for frontend jobs. Explain why subjective language creates inconsistent scoring."],
  ["Competitive Jobs Product Announcement", "Write a launch announcement introducing WorkProof competitive jobs and highest-passing-score rankings.", "Deliver a 500-750 word announcement with a clear title, opening problem, feature explanation, client benefits, freelancer benefits, fairness safeguards, and CTA. Accurately state that clients approve the final winner after the deadline."],
  ["GenLayer Verification Explainer", "Explain how GenLayer validators inspect public deliverables and reach consensus without using overly technical language.", "Deliver a 600-900 word explainer for nontechnical users. Define validators, consensus, passing criteria, quality score, and retries. Include one concrete writing-job example and clearly state that the client approves payout."],
  ["Public Deliverable URL Help Article", "Write a support article explaining which submission links validators can and cannot access.", "Deliver a 500-800 word article listing at least six supported public URL types and six unsuitable login-gated URL types. Include a five-step pre-submission test and explain how to recover when GenLayer review was interrupted."],
  ["Client Approval Notification Copy", "Design the complete in-app notification copy for the client approval lifecycle.", "Deliver a public document with notification title, body, CTA label, and severity for: submission received, GenLayer passed, GenLayer failed, competition ended, winner ready, client approved, reward claimed, and approval still pending. Each body must be under 140 characters."],
  ["Escrow Safety FAQ", "Write a trust-first FAQ explaining how funds move through WorkProof V3.", "Deliver exactly ten questions with 2-4 sentence answers. Cover escrow locking, contract custody, competitive deadlines, client approval, inactive clients, admin resolution, refunds, top-ups, claims, and Arbiscan verification. Total length 900-1300 words."],
  ["Competitive Submission Strategy Guide", "Help freelancers make stronger competitive submissions without encouraging spam.", "Deliver a 700-1000 word guide covering criteria analysis, evidence, public URLs, quality scoring, the three-attempt limit, ethical improvement, and deadline planning. Include a concise pre-submit checklist and discourage superficial resubmissions."],
  ["Client Review Checklist", "Create a structured checklist clients use when reviewing GenLayer's highest-ranked submission.", "Deliver a one-page public checklist with sections for criteria coverage, evidence quality, URL safety, score interpretation, competing entries, approval decision, and post-approval actions. Include at least 20 individually checkable items."],
  ["WorkProof Security Page Copy", "Write a professional security page describing contract controls and user responsibilities.", "Deliver 900-1300 words with sections on escrow, pull payments, client approval, competitive deadlines, pausing, bans, admin refunds, public URLs, wallet safety, and limitations. Do not claim the protocol is audited unless explicitly described as unaudited."],
  ["Writing Job Template Library", "Create reusable templates clients can use to post high-quality writing tasks.", "Deliver five complete templates: blog post, help article, launch announcement, email sequence, and technical explainer. Every template must include project brief, audience, deliverables, measurable acceptance criteria, excluded content, and suggested deadline."],
  ["Three-Email Freelancer Onboarding", "Write an onboarding email sequence for new WorkProof freelancers.", "Deliver exactly three emails. Each needs subject, preview text, body, and one CTA. Email one covers finding work, email two covers GenLayer-verifiable submissions, and email three covers client approval and claiming. Each body 180-260 words."],
  ["Client Onboarding Email Sequence", "Write a three-email sequence that helps clients post and resolve their first WorkProof job.", "Deliver exactly three emails with subject, preview, body, and CTA. Cover measurable criteria, choosing a job mode, funding escrow, reviewing ranked submissions, approving work, and resolving inactivity. Each body 180-280 words."],
  ["Protocol Glossary", "Create a plain-language glossary for the complete V3 workflow.", "Define exactly 20 terms alphabetically, including Application Job, Client Approval, Competitive Job, Direct Job, Escrow, GenLayer, Passing Score, Public Deliverable, Ranking, Submission, and Wallet. Each definition must be 20-45 words."],
  ["Dispute Preparation Guide", "Explain what evidence users should gather before requesting admin resolution.", "Deliver a 600-850 word guide covering transaction hashes, job IDs, acceptance criteria, submission URLs, GenLayer verdicts, client messages, deadlines, and wallet ownership. Include a copyable evidence checklist and distinguish disagreement from technical failure."],
  ["Activity Feed Event Copy", "Write concise user-facing descriptions for every important V3 protocol event.", "Deliver a table with event key, client-facing copy, freelancer-facing copy, and CTA for at least 16 events. Include submission recorded, review started, pass, fail, winner recommended, client approved, reward claimable, claimed, refunded, paused, and deleted."],
  ["WorkProof 90-Second Demo Script", "Write a judge-facing demo script showing the frontend-driven competitive workflow.", "Deliver a timed 90-second script with narrator lines and screen actions. Show posting a competitive content job, two submissions, browser-signed GenLayer review, ranking, deadline, client approval, notification, and claim. End with a one-sentence value proposition."],
  ["Client Inactivity Policy", "Write a clear policy explaining what happens when a client does not approve after a competition ends.", "Deliver a 500-750 word policy stating that escrow remains locked pending client or admin resolution. Cover user expectations, evidence, escalation path, prohibited abuse, and why the system does not silently select or refund without authorization."],
  ["Frontend-Only Architecture Explainer", "Explain why WorkProof signs GenLayer reviews in the browser instead of exposing an oracle private key.", "Deliver a 700-1000 word technical explainer. Cover browser wallet signing, StudioNet network switching, Arbitrum submission records, direct verdict reads, client approval authority, why embedded private keys are unsafe, and the remaining trust assumptions."]
] as const;

async function deleteV2Jobs() {
  const ids = await publicClient.readContract({ address: v2, abi, functionName: "getJobIds" });
  let deleted = 0;
  for (const id of ids) {
    const job = await publicClient.readContract({ address: v2, abi, functionName: "getJob", args: [id] });
    if ([5, 6, 7].includes(job.status)) continue;
    const hash = await wallet.writeContract({ address: v2, abi, functionName: "deleteJob", args: [id, "WorkProof V3 marketplace reset"] });
    await publicClient.waitForTransactionReceipt({ hash });
    deleted++;
    console.log(`deleted_v2=${deleted}/${ids.length} job=${id}`);
  }
  return deleted;
}

async function seedV3Jobs() {
  const now = Math.floor(Date.now() / 1000);
  for (let i = 0; i < jobs.length; i++) {
    const [title, brief, criteria] = jobs[i];
    const enriched = `PROJECT BRIEF:\n${brief}\n\nACCEPTANCE CRITERIA:\n${criteria}\n\nDELIVERABLES:\n- One public URL accessible without login.`;
    const deadline = BigInt(now + (i + 3) * 86400);
    const hash = await wallet.writeContract({
      address: v3,
      abi,
      functionName: "postJobV3",
      args: [title, `workproof-v3://content/${i + 1}`, enriched, "content", deadline, "0x0000000000000000000000000000000000000000", 2],
      value: parseEther("0.001")
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`seeded_v3=${i + 1}/${jobs.length} tx=${hash}`);
  }
}

async function main() {
  console.log(`deployer=${account.address}`);
  const deleted = await deleteV2Jobs();
  console.log(`v2_deleted=${deleted}`);
  await seedV3Jobs();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
