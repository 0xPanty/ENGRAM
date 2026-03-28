/**
 * E2E test: iTransfer with SoulClawVerifier (real signature verification)
 * 
 * Flow:
 * 1. Deploy MockVerifier + SoulClawV3 (for initial mint)
 * 2. Deploy SoulClawVerifier with oracle = deployer wallet
 * 3. Swap verifier to SoulClawVerifier
 * 4. Mint a soul NFT
 * 5. Generate TEE-style proof (oracle signs + receiver signs)
 * 6. Call iTransferFrom with proof
 * 7. Verify ownership + dataHash changed
 */

import { createPublicClient, createWalletClient, http, parseEther, keccak256, encodePacked, getAddress } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { readFileSync } from "fs";
import { join } from "path";

// === Config ===
const DEPLOYER_KEY = process.env.DEPLOYER_KEY;
if (!DEPLOYER_KEY) { console.error("Set DEPLOYER_KEY"); process.exit(1); }

const deployer = privateKeyToAccount(DEPLOYER_KEY);
// Generate a fresh receiver wallet for testing
const receiverKey = generatePrivateKey();
const receiver = privateKeyToAccount(receiverKey);

const rpc = "https://sepolia.base.org";
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
const deployerWallet = createWalletClient({ account: deployer, chain: baseSepolia, transport: http(rpc) });
const receiverWallet = createWalletClient({ account: receiver, chain: baseSepolia, transport: http(rpc) });

function getArtifact(name) {
  const p = join(process.cwd(), `artifacts/contracts/${name}.sol/${name}.json`);
  return JSON.parse(readFileSync(p, "utf8"));
}

async function deploy(name, args = []) {
  const artifact = getArtifact(name);
  console.log(`  Deploying ${name}...`);
  const nonce = await publicClient.getTransactionCount({ address: deployer.address });
  const hash = await deployerWallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode, args, nonce });
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  console.log(`  -> ${receipt.contractAddress}`);
  // Small delay to let RPC sync nonce
  await new Promise(r => setTimeout(r, 2000));
  return { address: receipt.contractAddress, abi: artifact.abi };
}

async function main() {
  console.log("=== iTransfer E2E Test ===\n");
  console.log(`Deployer (owner + oracle): ${deployer.address}`);
  console.log(`Receiver: ${receiver.address}`);

  // Fund receiver with a tiny bit of ETH (for gas if needed)
  const bal = await publicClient.getBalance({ address: deployer.address });
  console.log(`Deployer balance: ${Number(bal) / 1e18} ETH\n`);

  // 1. Deploy contracts
  console.log("Step 1: Deploy contracts");
  const mockVerifier = await deploy("MockVerifier");
  const soulClaw = await deploy("SoulClawV3", [mockVerifier.address]);
  
  // Deploy real verifier with deployer as oracle (simulating TEE)
  const realVerifier = await deploy("SoulClawVerifier", [deployer.address]);
  
  // Swap to real verifier
  console.log("  Swapping to SoulClawVerifier...");
  const swapHash = await deployerWallet.writeContract({
    address: soulClaw.address,
    abi: soulClaw.abi,
    functionName: "setVerifier",
    args: [realVerifier.address],
  });
  await publicClient.waitForTransactionReceipt({ hash: swapHash });
  
  const currentVerifier = await publicClient.readContract({
    address: soulClaw.address, abi: soulClaw.abi, functionName: "verifier"
  });
  console.log(`  Verifier now: ${currentVerifier}\n`);

  // 2. Mint a soul (deployer mints for themselves)
  console.log("Step 2: Mint soul NFT");
  const dataHash = keccak256(encodePacked(["string"], ["test-soul-data-v1"]));
  const mintHash = await deployerWallet.writeContract({
    address: soulClaw.address,
    abi: soulClaw.abi,
    functionName: "mintSoul",
    args: [dataHash, "0xstore123", "https://img.test/soul.png", "A test soul", "I am a test.", ["Testing"]],
    value: parseEther("0.001"),
  });
  const mintReceipt = await publicClient.waitForTransactionReceipt({ hash: mintHash });
  console.log(`  Minted! tx: ${mintHash}`);

  const soul0 = await publicClient.readContract({
    address: soulClaw.address, abi: soulClaw.abi, functionName: "getSoulData", args: [0n]
  });
  console.log(`  Token #0 owner: ${await publicClient.readContract({
    address: soulClaw.address, abi: soulClaw.abi, functionName: "ownerOf", args: [0n]
  })}`);
  console.log(`  Token #0 dataHash: ${soul0.dataHash}\n`);

  // 3. Build iTransfer proof
  console.log("Step 3: Build transfer proof");
  const newDataHash = keccak256(encodePacked(["string"], ["test-soul-data-v2-reencrypted"]));
  const sealedKey = keccak256(encodePacked(["string"], ["sealed-key-for-receiver"]));
  const nonce = keccak256(encodePacked(["string", "uint256"], ["transfer-nonce", BigInt(Date.now())]));

  // 3a. Receiver signs access proof: hash(oldDataHash, newDataHash, nonce)
  const accessMessage = keccak256(encodePacked(
    ["bytes32", "bytes32", "bytes"],
    [dataHash, newDataHash, nonce]
  ));
  console.log(`  Access message: ${accessMessage}`);
  const accessProof = await receiverWallet.signMessage({ message: { raw: accessMessage } });
  console.log(`  Receiver signed access proof`);

  // 3b. Oracle (deployer) signs ownership proof: hash(oldDataHash, newDataHash, sealedKey, nonce)
  const ownershipMessage = keccak256(encodePacked(
    ["bytes32", "bytes32", "bytes", "bytes"],
    [dataHash, newDataHash, sealedKey, nonce]
  ));
  console.log(`  Ownership message: ${ownershipMessage}`);
  const ownershipProof = await deployerWallet.signMessage({ message: { raw: ownershipMessage } });
  console.log(`  Oracle signed ownership proof\n`);

  // 4. Execute iTransferFrom
  console.log("Step 4: Execute iTransferFrom");
  const proof = {
    accessProof: accessProof,
    ownershipProof: ownershipProof,
    oldDataHash: dataHash,
    newDataHash: newDataHash,
    sealedKey: sealedKey,
    targetPubkey: "0x",
    wantedKey: "0x",
    nonce: nonce,
  };

  // Deployer (current owner) calls iTransferFrom
  const transferHash = await deployerWallet.writeContract({
    address: soulClaw.address,
    abi: soulClaw.abi,
    functionName: "iTransferFrom",
    args: [deployer.address, receiver.address, 0n, [proof]],
  });
  const transferReceipt = await publicClient.waitForTransactionReceipt({ hash: transferHash });
  console.log(`  iTransferFrom tx: ${transferHash}`);
  console.log(`  Status: ${transferReceipt.status}\n`);

  // 5. Verify result
  console.log("Step 5: Verify");
  const newOwner = await publicClient.readContract({
    address: soulClaw.address, abi: soulClaw.abi, functionName: "ownerOf", args: [0n]
  });
  const soul1 = await publicClient.readContract({
    address: soulClaw.address, abi: soulClaw.abi, functionName: "getSoulData", args: [0n]
  });

  console.log(`  New owner: ${newOwner}`);
  console.log(`  Expected:  ${receiver.address}`);
  console.log(`  Owner match: ${getAddress(newOwner) === getAddress(receiver.address)}`);
  console.log(`  New dataHash: ${soul1.dataHash}`);
  console.log(`  Expected:     ${newDataHash}`);
  console.log(`  Hash match: ${soul1.dataHash === newDataHash}`);
  console.log(`  Version: ${soul1.version} (should be 2)`);

  if (getAddress(newOwner) === getAddress(receiver.address) && soul1.dataHash === newDataHash) {
    console.log("\n=== SUCCESS: iTransfer with signature verification PASSED ===");
  } else {
    console.log("\n=== FAILED ===");
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
