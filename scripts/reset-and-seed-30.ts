// One-shot reset:
// 1. Refund every non-final job on the old WorkProof.
// 2. Sweep its stuck ETH back to the deployer.
// 3. Deploy a fresh WorkProof with the new oracle as initialOracle.
// 4. addOracle(newOracle) for redundancy.
// 5. Fund the new oracle wallet with 0.005 ETH.
// 6. Rotate WORKPROOF_CONTRACT + NEXT_PUBLIC_WORKPROOF_CONTRACT in .env and Vercel.
// 7. Truncate Supabase application tables.
// 8. Post 30 open content-writing jobs from the deployer.
//
// Usage:
//   npx tsx scripts/reset-and-seed-30.ts --dry-run
//   npx tsx scripts/reset-and-seed-30.ts --apply
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type Hex
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { workProofAbi } from "../frontend/lib/contracts";

const apply = process.argv.includes("--apply");
const dry = !apply;

const rpc = process.env.ARBITRUM_SEPOLIA_RPC ?? "https://sepolia-rollup.arbitrum.io/rpc";
const deployerKey = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
const oldContract = (process.env.WORKPROOF_CONTRACT ?? process.env.NEXT_PUBLIC_WORKPROOF_CONTRACT) as `0x${string}` | undefined;
const oracleAddress = process.env.ORACLE_WALLET as `0x${string}` | undefined;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseToken = process.env.SUPABASE_ACCESS_TOKEN ?? process.env.SUPABASE_ACCCESS_TOKEN;
const supabaseProjectRef = supabaseUrl ? supabaseUrl.replace(/^https?:\/\//, "").split(".")[0] : undefined;
const vercelToken = process.env.VERCEL_TOKEN;
const vercelProjectId = "prj_lGtiH6EzFC3eGpXoSJcSpBXU7Oyn"; // arbworkproof

if (!deployerKey) throw new Error("DEPLOYER_PRIVATE_KEY required");
if (!oracleAddress) throw new Error("ORACLE_WALLET required (run scripts/generate-oracle-wallet.ts first)");
if (!supabaseToken) throw new Error("SUPABASE_ACCESS_TOKEN required");
if (!supabaseProjectRef) throw new Error("SUPABASE_URL invalid");
if (!vercelToken) throw new Error("VERCEL_TOKEN required");

const ORACLE: `0x${string}` = oracleAddress;
const deployer = privateKeyToAccount(deployerKey);
const pub = createPublicClient({ chain: arbitrumSepolia, transport: http(rpc) });
const wallet = createWalletClient({ chain: arbitrumSepolia, transport: http(rpc), account: deployer });

function step(label: string) {
  console.log(`\n=== ${label} ${dry ? "[DRY-RUN]" : ""} ===`);
}

async function sql(query: string) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${supabaseProjectRef}/database/query`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${supabaseToken}`
    },
    body: JSON.stringify({ query })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`supabase ${res.status}: ${txt}`);
  }
  return res.json();
}

async function vercelEnv(envs: Array<{ key: string; value: string; type: "plain" | "encrypted" }>) {
  // Delete the existing values for the keys we want to upsert
  const existing = await (await fetch(
    `https://api.vercel.com/v9/projects/${vercelProjectId}/env`,
    { headers: { authorization: `Bearer ${vercelToken}` } }
  )).json();
  for (const e of envs) {
    const ids = (existing.envs as Array<{ id: string; key: string }>)?.filter((x) => x.key === e.key) ?? [];
    for (const x of ids) {
      await fetch(`https://api.vercel.com/v9/projects/${vercelProjectId}/env/${x.id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${vercelToken}` }
      });
    }
  }
  const payload = envs.map((e) => ({
    key: e.key, value: e.value, type: e.type, target: ["production", "preview", "development"]
  }));
  const res = await fetch(`https://api.vercel.com/v10/projects/${vercelProjectId}/env?upsert=true`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${vercelToken}` },
    body: JSON.stringify(payload)
  });
  const body = await res.json();
  if (!res.ok || (body.failed && body.failed.length)) {
    throw new Error(`vercel env upsert failed: ${JSON.stringify(body)}`);
  }
  return body;
}

// ---- 30 job briefs ----
const BRIEFS = [
  ["Premier League season summary", "Write a 400-500 word recap of the most recent Premier League season. Must mention at least 5 clubs by name, the final-table winner, and one notable mid-season storyline."],
  ["NBA Finals one-pager", "Write a 350-450 word recap of the most recent NBA Finals. Include both team names, the series score, and at least 2 player names."],
  ["UEFA Champions League final recap", "Write a 400-500 word recap of the most recent UCL final. Mention both clubs, the venue, and at least 3 goal-scorers."],
  ["MLB World Series wrap-up", "Write a 350-450 word recap of the most recent World Series. Include both teams, the series result, and the MVP."],
  ["Formula 1 season highlights", "Write a 400-500 word recap of the most recent F1 season. Include constructors champion, drivers champion, and at least 2 race winners other than the champion."],
  ["NFL Super Bowl recap", "Write a 400-500 word recap of the most recent Super Bowl. Include both teams, the final score, and the MVP."],
  ["NHL Stanley Cup wrap-up", "Write a 350-450 word recap of the most recent Stanley Cup Final. Include both teams, the series score, and the Conn Smythe winner."],
  ["Roland Garros recap", "Write a 350-450 word recap of the most recent French Open. Cover men's and women's singles winners."],
  ["MLS Cup Final summary", "Write a 350-450 word recap of the most recent MLS Cup Final. Cover both clubs and the result."],
  ["WNBA Finals recap", "Write a 350-450 word recap of the most recent WNBA Finals. Include both teams and at least 2 player names."],
  ["UFC card review", "Write a 350-450 word review of any recent UFC pay-per-view. Cover at least 3 fight results."],
  ["PGA Tour event recap", "Write a 350-450 word recap of any recent PGA Tour event. Include the winner and the runner-up."],
  ["ATP Tour update", "Write a 300-400 word update on the men's tennis ATP rankings. Include the current top 5 by name."],
  ["WTA Tour update", "Write a 300-400 word update on the women's tennis WTA rankings. Include the current top 5 by name."],
  ["EuroLeague basketball recap", "Write a 350-450 word recap of the most recent EuroLeague basketball season. Include the champion and Final Four teams."],
  ["UEFA EURO recap", "Write a 400-500 word recap of the most recent UEFA EURO tournament. Include the winner, runner-up, and golden boot."],
  ["Copa Libertadores recap", "Write a 350-450 word recap of the most recent Copa Libertadores. Include the winner and finalist."],
  ["AFC Champions League recap", "Write a 350-450 word recap of the most recent AFC Champions League. Include the winner and the final score."],
  ["CONMEBOL eliminatorias update", "Write a 300-400 word update on the South American World Cup qualifiers. Include the top 3 teams in the current table."],
  ["Premier Lacrosse League recap", "Write a 300-400 word recap of the most recent PLL season. Include the championship winner and one MVP."],
  ["KHL hockey season recap", "Write a 350-450 word recap of the most recent KHL season. Include the Gagarin Cup winner."],
  ["A-League final recap", "Write a 350-450 word recap of the most recent A-League grand final. Include both clubs and the result."],
  ["J.League season recap", "Write a 350-450 word recap of the most recent J1 League season. Include the winner and runner-up."],
  ["K League season recap", "Write a 350-450 word recap of the most recent K League 1 season. Include the winner and at least 2 top scorers."],
  ["Bundesliga season recap", "Write a 400-500 word recap of the most recent Bundesliga season. Include the title winner and the relegation candidates."],
  ["La Liga season recap", "Write a 400-500 word recap of the most recent La Liga season. Include the title winner and the top scorer."],
  ["Serie A season recap", "Write a 400-500 word recap of the most recent Serie A season. Include the Scudetto winner and the top scorer."],
  ["Ligue 1 season recap", "Write a 400-500 word recap of the most recent Ligue 1 season. Include the champion and the runner-up."],
  ["FIFA Women's World Cup recap", "Write a 400-500 word recap of the most recent FIFA Women's World Cup. Include the winner, runner-up, and golden boot."],
  ["Cricket world tournament recap", "Write a 350-450 word recap of the most recent ICC World Cup. Include the winner and the player of the tournament."]
];

function jobCriteria(brief: string) {
  return `PROJECT BRIEF:
${brief}

ACCEPTANCE CRITERIA:
- Deliverable is a publicly accessible URL (no login).
- Word count within the range specified in the brief.
- Specific facts mentioned in the brief (team names, scores, players) are all included.
- Written in plain prose, no AI hedging phrases like "as of my knowledge cutoff".
- Spelling and grammar are correct.`;
}

async function main() {
  console.log(`mode: ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`deployer: ${deployer.address}`);
  console.log(`old contract: ${oldContract}`);
  console.log(`oracle: ${oracleAddress}`);

  // -- 1. Refund every non-final job on the old contract
  if (oldContract) {
    step("Phase 1 — refund every non-final job on old contract");
    try {
      const ids = (await pub.readContract({
        address: oldContract,
        abi: workProofAbi,
        functionName: "getJobIds"
      })) as readonly Hex[];
      console.log(`  found ${ids.length} jobs`);
      let refunded = 0;
      for (const id of ids) {
        try {
          const job = (await pub.readContract({
            address: oldContract,
            abi: workProofAbi,
            functionName: "getJob",
            args: [id]
          })) as { status: number };
          const finalStatuses = [5, 6, 7, 8]; // Passed, AwaitingApproval, Complete, Refunded (approx)
          if (finalStatuses.includes(Number(job.status))) continue;
          if (!apply) { refunded++; continue; }
          const hash = await wallet.writeContract({
            address: oldContract,
            abi: workProofAbi,
            functionName: "adminForceRefund",
            args: [id, "reset-and-seed-30"]
          });
          await pub.waitForTransactionReceipt({ hash });
          refunded++;
          process.stdout.write(".");
        } catch (e) {
          process.stdout.write("x");
        }
      }
      console.log(`\n  refunded ${refunded}`);
    } catch (e) {
      console.warn(`  could not enumerate old contract (${(e as Error).message}); skipping`);
    }

    // -- 2. Sweep stuck ETH
    step("Phase 2 — sweepStuckEth from old contract");
    const balBefore = await pub.getBalance({ address: oldContract });
    console.log(`  old contract balance before: ${balBefore} wei`);
    if (apply && balBefore > 0n) {
      try {
        const hash = await wallet.writeContract({
          address: oldContract,
          abi: workProofAbi,
          functionName: "sweepStuckEth",
          args: [deployer.address]
        });
        await pub.waitForTransactionReceipt({ hash });
        const balAfter = await pub.getBalance({ address: oldContract });
        console.log(`  swept; balance after: ${balAfter} wei (tx ${hash})`);
      } catch (e) {
        console.warn(`  sweep failed: ${(e as Error).message}`);
      }
    }
  }

  // -- 3. Deploy new WorkProof via Hardhat
  step("Phase 3 — deploy fresh WorkProof with new oracle");
  let newContract: `0x${string}` | undefined;
  if (apply) {
    execFileSync("npx", ["hardhat", "run", "contracts/arbitrum/deploy/deploy.ts", "--network", "arbitrumSepolia"], {
      stdio: "inherit",
      env: { ...process.env, ORACLE_WALLET: oracleAddress }
    });
    const deployFile = path.join(process.cwd(), "deployments", "arbitrum-sepolia.json");
    const deployJson = JSON.parse(fs.readFileSync(deployFile, "utf8")) as { workProof: string };
    newContract = deployJson.workProof as `0x${string}`;
    console.log(`  new WorkProof: ${newContract}`);
  } else {
    console.log(`  would run: npx hardhat run contracts/arbitrum/deploy/deploy.ts --network arbitrumSepolia`);
  }

  // -- 4. addOracle (constructor already sets initialOracle, but be defensive)
  step("Phase 4 — addOracle on new contract");
  if (apply && newContract) {
    try {
      const hash = await wallet.writeContract({
        address: newContract,
        abi: workProofAbi,
        functionName: "addOracle",
        args: [ORACLE]
      });
      await pub.waitForTransactionReceipt({ hash });
      console.log(`  addOracle tx: ${hash}`);
    } catch (e) {
      console.warn(`  addOracle skipped: ${(e as Error).message}`);
    }
  }

  // -- 5. Fund the oracle wallet
  step("Phase 5 — fund oracle wallet with 0.005 ETH");
  const oracleBal = await pub.getBalance({ address: ORACLE });
  console.log(`  oracle balance: ${oracleBal} wei`);
  if (apply && oracleBal < parseEther("0.004")) {
    const hash = await wallet.sendTransaction({ to: ORACLE, value: parseEther("0.005") });
    await pub.waitForTransactionReceipt({ hash });
    console.log(`  funded; tx ${hash}`);
  }

  // -- 6. Rotate env in .env and Vercel
  if (newContract) {
    step("Phase 6 — rotate WORKPROOF_CONTRACT in .env and Vercel");
    if (apply) {
      // Update local .env
      const envPath = path.join(process.cwd(), ".env");
      let body = fs.readFileSync(envPath, "utf8");
      body = body.replace(/^WORKPROOF_CONTRACT=.*$/m, `WORKPROOF_CONTRACT=${newContract}`);
      body = body.replace(/^NEXT_PUBLIC_WORKPROOF_CONTRACT=.*$/m, `NEXT_PUBLIC_WORKPROOF_CONTRACT=${newContract}`);
      // If keys are absent, append them
      if (!/^WORKPROOF_CONTRACT=/m.test(body)) body += `\nWORKPROOF_CONTRACT=${newContract}\n`;
      if (!/^NEXT_PUBLIC_WORKPROOF_CONTRACT=/m.test(body)) body += `\nNEXT_PUBLIC_WORKPROOF_CONTRACT=${newContract}\n`;
      fs.writeFileSync(envPath, body);
      console.log(`  .env updated`);
      await vercelEnv([
        { key: "WORKPROOF_CONTRACT", value: newContract, type: "plain" },
        { key: "NEXT_PUBLIC_WORKPROOF_CONTRACT", value: newContract, type: "plain" }
      ]);
      console.log(`  Vercel envs upserted`);
    }
  }

  // -- 7. Truncate Supabase tables
  step("Phase 7 — truncate Supabase tables");
  const TABLES = ["jobs", "submissions", "claim_queue", "activity_log", "genlayer_submissions", "ingest_cursors", "disputes", "notifications", "applications"];
  if (apply) {
    for (const t of TABLES) {
      try {
        await sql(`truncate table public.${t} restart identity cascade;`);
        console.log(`  truncated ${t}`);
      } catch (e) {
        console.log(`  skipped ${t}: ${(e as Error).message.slice(0, 100)}`);
      }
    }
  }

  // -- 8. Post 30 jobs from the deployer on the NEW contract
  step("Phase 8 — post 30 content-writing jobs on new contract");
  const target: `0x${string}` | undefined = newContract ?? oldContract;
  if (!target) throw new Error("no contract to post jobs on");
  const targetAddr: `0x${string}` = target;
  if (apply) {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);
    const reward = parseEther("0.0005");
    for (let i = 0; i < BRIEFS.length; i++) {
      const [title, brief] = BRIEFS[i];
      try {
        const hash = await wallet.writeContract({
          address: targetAddr,
          abi: workProofAbi,
          functionName: "postJobV3",
          args: [
            title,
            `workproof-seed://${i}`,
            jobCriteria(brief),
            "content",
            deadline,
            "0x0000000000000000000000000000000000000000",
            0 // JobMode.Application
          ],
          value: reward
        });
        await pub.waitForTransactionReceipt({ hash });
        process.stdout.write(".");
      } catch (e) {
        process.stdout.write(`x(${i})`);
        console.warn(`\n  job ${i} (${title}) failed: ${(e as Error).message.slice(0, 120)}`);
      }
    }
    console.log("\n  done");
  } else {
    console.log(`  would post ${BRIEFS.length} jobs on ${targetAddr}`);
  }

  console.log(`\n${apply ? "APPLY COMPLETE" : "DRY-RUN COMPLETE — nothing changed. Re-run with --apply."}`);
  if (newContract) {
    console.log(`new contract: ${newContract}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
