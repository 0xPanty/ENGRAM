import hre from "hardhat";

async function main() {
  const { viem } = await hre.network.connect();
  const [deployer] = await viem.getWalletClients();

  console.log("Deploying SoulClawV3 with account:", deployer.account.address);
  console.log("Network:", hre.network.name);

  // Step 1: Deploy MockVerifier
  console.log("\n1. Deploying MockVerifier...");
  const mockVerifier = await viem.deployContract("MockVerifier");
  console.log("   MockVerifier deployed to:", mockVerifier.address);

  // Step 2: Deploy SoulClawV3 with verifier address
  console.log("\n2. Deploying SoulClawV3...");
  const soulClaw = await viem.deployContract("SoulClawV3", [mockVerifier.address]);
  console.log("   SoulClawV3 deployed to:", soulClaw.address);

  // Wait for confirmation
  console.log("\nWaiting for confirmation...");
  await new Promise((r) => setTimeout(r, 5000));

  try {
    const name = await soulClaw.read.name();
    const symbol = await soulClaw.read.symbol();
    const mintPrice = await soulClaw.read.mintPrice();
    const owner = await soulClaw.read.owner();
    const verifier = await soulClaw.read.verifier();

    console.log(`\nContract info:`);
    console.log(`  Name: ${name}`);
    console.log(`  Symbol: ${symbol}`);
    console.log(`  Mint Price: ${mintPrice} wei`);
    console.log(`  Owner: ${owner}`);
    console.log(`  Verifier: ${verifier}`);
  } catch {
    console.log("  (Could not read contract state yet)");
  }

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log(`MockVerifier: ${mockVerifier.address}`);
  console.log(`SoulClawV3:   ${soulClaw.address}`);
  console.log("\nUpdate .env.local / Vercel with:");
  console.log(`  NEXT_PUBLIC_CONTRACT_ADDRESS=${soulClaw.address}`);
  console.log(`  MOCK_VERIFIER_ADDRESS=${mockVerifier.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
