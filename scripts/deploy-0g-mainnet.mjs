import { createPublicClient, createWalletClient, http, formatEther, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";
import { join } from "path";
import dotenv from "dotenv";
dotenv.config();

const og = defineChain({
  id: 16661,
  name: "0G Mainnet",
  nativeCurrency: { name: "A0GI", symbol: "A0GI", decimals: 18 },
  rpcUrls: { default: { http: ["https://evmrpc.0g.ai"] } },
  blockExplorers: { default: { name: "0G Explorer", url: "https://chainscan.0g.ai" } },
});

const PRIVATE_KEY = process.env.DEPLOYER_KEY;
if (!PRIVATE_KEY) {
  console.error("Set DEPLOYER_KEY in .env");
  process.exit(1);
}

const account = privateKeyToAccount(PRIVATE_KEY);

const publicClient = createPublicClient({
  chain: og,
  transport: http(og.rpcUrls.default.http[0]),
});

const walletClient = createWalletClient({
  account,
  chain: og,
  transport: http(og.rpcUrls.default.http[0]),
});

function getArtifact(contractPath, name) {
  const path = join(process.cwd(), `artifacts/contracts/${contractPath}/${name}.json`);
  return JSON.parse(readFileSync(path, "utf8"));
}

async function deploy(contractPath, name, args = []) {
  const artifact = getArtifact(contractPath, name);
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
  console.log(`Balance: ${formatEther(balance)} A0GI`);
  console.log(`Network: 0G Mainnet (${og.id})\n`);

  // 1. Deploy SoulClawVerifier (with deployer as mock oracle for now)
  const verifier = await deploy("SoulClawVerifier.sol", "SoulClawVerifier", [account.address]);

  // 2. Deploy SoulClawV3 with verifier
  const soulClaw = await deploy("SoulClawV3.sol", "SoulClawV3", [verifier.address]);

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
  console.log(`SoulClawVerifier: ${verifier.address}`);
  console.log(`SoulClawV3:       ${soulClaw.address}`);
  console.log(`Oracle (mock):    ${account.address}`);
  console.log(`\nWhen TEE Oracle is available, call verifier.setOracleAddress(teeOracleAddr)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
