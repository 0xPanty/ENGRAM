import hre from "hardhat";

async function main() {
  const { viem } = await hre.network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();

  console.log("Deploying SoulClaw with account:", deployer.account.address);
  console.log("Network:", hre.network.name);

  const soulClaw = await viem.deployContract("SoulClaw");
  const address = soulClaw.address;

  console.log("SoulClaw deployed to:", address);

  // 等一会让交易确认
  console.log("Waiting for confirmation...");
  await new Promise((r) => setTimeout(r, 5000));

  try {
    const name = await soulClaw.read.name();
    const symbol = await soulClaw.read.symbol();
    const mintPrice = await soulClaw.read.mintPrice();
    const owner = await soulClaw.read.owner();

    console.log(`  Name: ${name}`);
    console.log(`  Symbol: ${symbol}`);
    console.log(`  Mint Price: ${mintPrice} wei`);
    console.log(`  Owner: ${owner}`);
  } catch {
    console.log("  (Could not read contract state yet, but deployment tx was sent)");
  }

  console.log("\nDone. Update .env.local with:");
  console.log(`  NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
