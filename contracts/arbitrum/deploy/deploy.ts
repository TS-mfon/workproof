import { ethers } from "hardhat";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const oracle = process.env.ORACLE_WALLET;
  if (!oracle) {
    throw new Error("ORACLE_WALLET is required");
  }

  const WorkProof = await ethers.getContractFactory("WorkProof");
  const workProof = await WorkProof.deploy(oracle);
  await workProof.waitForDeployment();

  const network = await ethers.provider.getNetwork();
  const deployment = {
    network: "arbitrum-sepolia",
    chainId: Number(network.chainId),
    deployer: (await ethers.getSigners())[0].address,
    oracle,
    workProof: await workProof.getAddress(),
    rpc: process.env.ARBITRUM_SEPOLIA_RPC ?? "https://sepolia-rollup.arbitrum.io/rpc",
    explorer: "https://sepolia.arbiscan.io",
    deployedAt: new Date().toISOString()
  };

  const outDir = path.join(process.cwd(), "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "arbitrum-sepolia.json"), `${JSON.stringify(deployment, null, 2)}\n`);

  console.log("WorkProof:", deployment.workProof);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
