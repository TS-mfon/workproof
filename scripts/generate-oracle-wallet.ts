import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const ENV_PATH = resolve(process.cwd(), ".env");

function readEnv(): Record<string, string> {
  if (!existsSync(ENV_PATH)) return {};
  const out: Record<string, string> = {};
  for (const raw of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

function writeEnv(map: Record<string, string>, order: string[]) {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const k of order) {
    if (k in map) {
      lines.push(`${k}=${map[k]}`);
      seen.add(k);
    }
  }
  for (const [k, v] of Object.entries(map)) {
    if (!seen.has(k)) lines.push(`${k}=${v}`);
  }
  writeFileSync(ENV_PATH, lines.join("\n") + "\n", { mode: 0o600 });
}

function main() {
  const env = readEnv();
  const previousKey = env.ORACLE_PRIVATE_KEY;
  const previousAddr = env.ORACLE_WALLET;

  if (existsSync(ENV_PATH)) {
    copyFileSync(ENV_PATH, `${ENV_PATH}.bak`);
  }

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  if (previousKey) env.ORACLE_PRIVATE_KEY_PREVIOUS = previousKey;
  if (previousAddr) env.ORACLE_WALLET_PREVIOUS = previousAddr;
  env.ORACLE_PRIVATE_KEY = privateKey;
  env.ORACLE_WALLET = account.address;

  const order = [
    "DEPLOYER_PRIVATE_KEY",
    "ARBITRUM_SEPOLIA_RPC",
    "ORACLE_PRIVATE_KEY",
    "ORACLE_WALLET",
    "ORACLE_PRIVATE_KEY_PREVIOUS",
    "ORACLE_WALLET_PREVIOUS",
    "NEXT_PUBLIC_WORKPROOF_CONTRACT",
    "WORKPROOF_CONTRACT",
    "GENLAYER_STUDIO_RPC",
    "GENLAYER_CONTRACT",
    "NEXT_PUBLIC_GENLAYER_CONTRACT",
    "CRON_SECRET",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_ACCESS_TOKEN",
    "SUPABASE_ACCCESS_TOKEN",
    "GITHUB_TOKEN",
    "VERCEL_TOKEN"
  ];
  writeEnv(env, order);

  console.log("New oracle wallet generated.");
  console.log(`  address:           ${account.address}`);
  console.log(`  .env updated:      ${ENV_PATH}`);
  console.log(`  backup written to: ${ENV_PATH}.bak`);
  if (previousAddr) {
    console.log(`  previous address (archived as ORACLE_WALLET_PREVIOUS): ${previousAddr}`);
  }
  console.log("");
  console.log("Reminder: if this address must be authorised on-chain for receiveVerdict/autoRefund,");
  console.log("call WorkProof.setOracle(<address>) (or equivalent) from the deployer key.");
  console.log("Otherwise, set RELAY_PRIVATE_KEY in env to keep the previous key for Arbitrum writes.");
}

main();
