import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { readFileSync } from "fs";
import { join } from "path";

const PRIVATE_KEY = process.env.DEPLOYER_KEY;
if (!PRIVATE_KEY) {
  console.error("Set DEPLOYER_KEY env var");
  process.exit(1);
}

const account = privateKeyToAccount(PRIVATE_KEY);
const rpcUrl = "https://sepolia.base.org";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(rpcUrl),
});

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(rpcUrl),
});

function getArtifact(name) {
  const path = join(process.cwd(), `artifacts/contracts/${name}.sol/${name}.json`);
  return JSON.parse(readFileSync(path, "utf8"));
}

async function deploy(name, args = []) {
  const artifact = getArtifact(name);
  console.log(`Deploying ${name}...`);

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args,
  });

  console.log(`  tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  address: ${receipt.contractAddress}`);
  return { address: receipt.contractAddress, abi: artifact.abi };
}

async function main() {
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Deployer: ${account.address}`);
  console.log(`Balance: ${balance} wei (${Number(balance) / 1e18} ETH)`);
  console.log(`Network: Base Sepolia (${baseSepolia.id})\n`);

  // 1. Deploy MockVerifier
  const verifier = await deploy("MockVerifier");

  // 2. Deploy SoulClawV3
  const soulClaw = await deploy("SoulClawV3", [verifier.address]);

  // 3. Verify
  console.log("\nVerifying deployment...");
  const name = await publicClient.readContract({
    address: soulClaw.address,
    abi: soulClaw.abi,
    functionName: "name",
  });
  const symbol = await publicClient.readContract({
    address: soulClaw.address,
    abi: soulClaw.abi,
    functionName: "symbol",
  });
  const v = await publicClient.readContract({
    address: soulClaw.address,
    abi: soulClaw.abi,
    functionName: "verifier",
  });

  console.log(`  Name: ${name}`);
  console.log(`  Symbol: ${symbol}`);
  console.log(`  Verifier: ${v}`);

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log(`MockVerifier: ${verifier.address}`);
  console.log(`SoulClawV3:   ${soulClaw.address}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
