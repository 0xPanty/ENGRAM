/**
 * E2E test: iTransfer with SoulClawVerifier on Base Sepolia
 * Uses already-deployed contracts from previous run, deploys fresh set with nonce management.
 */

import { createPublicClient, createWalletClient, http, parseEther, keccak256, encodePacked, getAddress } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { readFileSync } from "fs";
import { join } from "path";

const DEPLOYER_KEY = process.env.DEPLOYER_KEY;
if (!DEPLOYER_KEY) { console.error("Set DEPLOYER_KEY"); process.exit(1); }

const deployer = privateKeyToAccount(DEPLOYER_KEY);
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

let nextNonce = null;

async function initNonce() {
  nextNonce = await publicClient.getTransactionCount({ address: deployer.address, blockTag: "pending" });
  console.log(`Starting nonce: ${nextNonce}`);
}

async function deploy(name, args = []) {
  const artifact = getArtifact(name);
  const nonce = nextNonce++;
  console.log(`  Deploying ${name} (nonce=${nonce})...`);
  const hash = await deployerWallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode, args, nonce });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  -> ${receipt.contractAddress}`);
  return { address: receipt.contractAddress, abi: artifact.abi };
}

async function writeAndWait(address, abi, functionName, args, value) {
  const nonce = nextNonce++;
  const opts = { address, abi, functionName, args, nonce };
  if (value) opts.value = value;
  const hash = await deployerWallet.writeContract(opts);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { hash, receipt };
}

async function main() {
  console.log("=== iTransfer E2E Test (with signature verification) ===\n");
  console.log(`Deployer (owner + oracle): ${deployer.address}`);
  console.log(`Receiver: ${receiver.address}`);
  const bal = await publicClient.getBalance({ address: deployer.address });
  console.log(`Balance: ${Number(bal) / 1e18} ETH\n`);

  // 1. Deploy all 3 contracts sequentially
  console.log("Step 1: Deploy contracts");
  await initNonce();

  const mockVerifier = await deploy("MockVerifier");
  const soulClaw = await deploy("SoulClawV3", [mockVerifier.address]);
  const realVerifier = await deploy("SoulClawVerifier", [deployer.address]);

  // 2. Swap verifier
  console.log("\nStep 2: Swap to SoulClawVerifier");
  const { hash: swapHash } = await writeAndWait(
    soulClaw.address, soulClaw.abi, "setVerifier", [realVerifier.address]
  );
  console.log(`  setVerifier tx: ${swapHash}`);
  const v = await publicClient.readContract({ address: soulClaw.address, abi: soulClaw.abi, functionName: "verifier" });
  console.log(`  Verifier: ${v}`);

  // 3. Mint
  console.log("\nStep 3: Mint soul");
  const dataHash = keccak256(encodePacked(["string"], ["soul-data-v1"]));
  const { hash: mintHash } = await writeAndWait(
    soulClaw.address, soulClaw.abi, "mintSoul",
    [dataHash, "0xstore123", "https://img/soul.png", "Test soul", "I exist.", ["Coding"]],
    parseEther("0.001")
  );
  console.log(`  Mint tx: ${mintHash}`);
  const owner0 = await publicClient.readContract({ address: soulClaw.address, abi: soulClaw.abi, functionName: "ownerOf", args: [0n] });
  console.log(`  Token #0 owner: ${owner0}`);

  // 4. Build proof
  console.log("\nStep 4: Build iTransfer proof");
  const newDataHash = keccak256(encodePacked(["string"], ["soul-data-v2-reencrypted"]));
  const sealedKey = keccak256(encodePacked(["string"], ["sealed-key-for-receiver"]));
  const nonce = keccak256(encodePacked(["string", "uint256"], ["nonce", BigInt(Date.now())]));

  // Receiver signs access proof
  const accessMsg = keccak256(encodePacked(["bytes32", "bytes32", "bytes"], [dataHash, newDataHash, nonce]));
  const accessProof = await receiverWallet.signMessage({ message: { raw: accessMsg } });
  console.log(`  Receiver signed access proof`);

  // Oracle (deployer) signs ownership proof
  const ownershipMsg = keccak256(encodePacked(["bytes32", "bytes32", "bytes", "bytes"], [dataHash, newDataHash, sealedKey, nonce]));
  const ownershipProof = await deployerWallet.signMessage({ message: { raw: ownershipMsg } });
  console.log(`  Oracle signed ownership proof`);

  // 5. iTransferFrom
  console.log("\nStep 5: Execute iTransferFrom");
  const proof = {
    accessProof,
    ownershipProof,
    oldDataHash: dataHash,
    newDataHash,
    sealedKey,
    targetPubkey: "0x",
    wantedKey: "0x",
    nonce,
  };

  const { hash: txHash, receipt: txReceipt } = await writeAndWait(
    soulClaw.address, soulClaw.abi, "iTransferFrom",
    [deployer.address, receiver.address, 0n, [proof]]
  );
  console.log(`  iTransferFrom tx: ${txHash}`);
  console.log(`  Status: ${txReceipt.status}`);

  // 6. Verify
  console.log("\nStep 6: Verify");
  const newOwner = await publicClient.readContract({ address: soulClaw.address, abi: soulClaw.abi, functionName: "ownerOf", args: [0n] });
  const soul = await publicClient.readContract({ address: soulClaw.address, abi: soulClaw.abi, functionName: "getSoulData", args: [0n] });

  console.log(`  New owner: ${newOwner}`);
  console.log(`  Expected:  ${receiver.address}`);
  const ownerMatch = getAddress(newOwner) === getAddress(receiver.address);
  console.log(`  Owner match: ${ownerMatch}`);
  console.log(`  New dataHash: ${soul.dataHash}`);
  console.log(`  Expected:     ${newDataHash}`);
  const hashMatch = soul.dataHash === newDataHash;
  console.log(`  Hash match: ${hashMatch}`);
  console.log(`  Version: ${soul.version} (expect 2)`);

  if (ownerMatch && hashMatch && soul.version === 2n) {
    console.log("\n=== SUCCESS: iTransfer with ECDSA signature verification PASSED on Base Sepolia ===");
    console.log("\nContracts:");
    console.log(`  SoulClawV3:       ${soulClaw.address}`);
    console.log(`  SoulClawVerifier: ${realVerifier.address}`);
    console.log(`  MockVerifier:     ${mockVerifier.address}`);
  } else {
    console.log("\n=== FAILED ===");
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
