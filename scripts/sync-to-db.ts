import "dotenv/config";
import { createPublicClient, http, getAddress, type Hex } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { createClient } from "@supabase/supabase-js";
import { workProofAbi } from "../frontend/lib/contracts";

const rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC ?? "https://sepolia-rollup.arbitrum.io/rpc";
const address = (process.env.WORKPROOF_CONTRACT ?? process.env.NEXT_PUBLIC_WORKPROOF_CONTRACT) as Hex;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const statusLabels = ["Open", "Active", "UnderReview", "Failed", "Passed", "Complete", "Refunded", "Deleted"];

if (!address || !supabaseUrl || !supabaseKey) {
  console.error("Missing: WORKPROOF_CONTRACT, SUPABASE_URL, SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(rpcUrl) });
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

async function main() {
  const ids = await publicClient.readContract({ address, abi: workProofAbi, functionName: "getJobIds" });
  console.log(`Found ${ids.length} jobs on-chain`);

  let jobsInserted = 0;
  for (let i = 0; i < ids.length; i++) {
    try {
      const job = await publicClient.readContract({ address, abi: workProofAbi, functionName: "getJob", args: [ids[i]] });
      const freelancer = job.assignedFreelancer === "0x0000000000000000000000000000000000000000" ? null : getAddress(job.assignedFreelancer);
      const status = statusLabels[Number(job.status)] ?? "Open";
      const claimed = await publicClient.readContract({ address, abi: workProofAbi, functionName: "rewardClaimed", args: [ids[i]] });
      const score = await publicClient.readContract({ address, abi: workProofAbi, functionName: "verdictQualityScore", args: [ids[i]] });

      try { await supabase.from("users").upsert({ wallet_address: job.client, role: "client", jobs_posted: 1 }, { onConflict: "wallet_address" }); } catch {}
      if (freelancer) { try { await supabase.from("users").upsert({ wallet_address: freelancer, role: "freelancer" }, { onConflict: "wallet_address" }); } catch {} }

      const criteria = String(job.acceptanceCriteria || "");
      const brief = criteria.match(/PROJECT BRIEF:\s*([\s\S]*?)(?:\n\s*ACCEPTANCE CRITERIA:|\n\s*DELIVERABLES:|$)/i)?.[1]?.trim();
      const description = brief?.replace(/\s+/g, " ") || `Onchain WorkProof job for ${job.title}. Domain ${job.domain}.`;

      const { error } = await supabase.from("jobs").upsert({
        job_id_onchain: ids[i],
        client_wallet: job.client,
        freelancer_wallet: freelancer,
        assigned_to_wallet: freelancer,
        title: job.title,
        description,
        spec_ipfs_hash: job.specIpfsHash || null,
        acceptance_criteria: criteria,
        domain: job.domain,
        escrow_amount_wei: job.escrowAmount.toString(),
        reward_amount_wei: job.rewardAmount.toString(),
        status,
        retry_count: Number(job.retryCount),
        deliverable_url: job.deliverableUrl || null,
        deadline: new Date(Number(job.deadline) * 1000).toISOString(),
        created_at: new Date(Number(job.createdAt) * 1000).toISOString(),
        ai_verdict: job.status >= 3 ? { source: "onchain", quality_score: Number(score), status } : null,
        completed_at: claimed || status === "Complete" ? new Date().toISOString() : null
      }, { onConflict: "job_id_onchain" });
      if (error) { console.error(`job ${i} failed:`, error.message); continue; }
      jobsInserted++;

      if (status === "Passed" && freelancer) {
        try { await supabase.from("claim_queue").upsert({
          job_id_onchain: ids[i], freelancer_wallet: freelancer, reward_wei: job.rewardAmount.toString(),
          quality_score: Number(score), ai_summary: "Synced from on-chain.", status: "pending"
        }, { onConflict: "job_id_onchain" }); } catch {}
      }
    } catch (err: any) {
      console.error(`job ${i} error:`, err?.message);
    }
  }
  console.log(`Synced ${jobsInserted}/${ids.length} jobs`);

  const count = await publicClient.readContract({ address, abi: workProofAbi, functionName: "getWalletCount" });
  const profiles = await publicClient.readContract({ address, abi: workProofAbi, functionName: "getTopFreelancers", args: [count] });
  let usersUpdated = 0;
  for (const p of profiles) {
    if (p.wallet === "0x0000000000000000000000000000000000000000") continue;
    try {
      await supabase.from("users").upsert({
        wallet_address: getAddress(p.wallet), role: "both", reputation_pts: Number(p.reputationPoints),
        jobs_completed: Number(p.jobsCompleted), jobs_failed: Number(p.jobsFailed),
        total_earned_wei: p.totalEarned.toString(), domains: p.domain ? [p.domain] : null
      }, { onConflict: "wallet_address" });
      usersUpdated++;
    } catch {}
  }
  console.log(`Synced ${usersUpdated} user profiles`);
  console.log("Done.");
}

main().catch((err) => { console.error(err); process.exit(1); });
