/**
 * iTransfer test using already-deployed contracts on Base Sepolia.
 * SoulClawV3: 0x57f3a2b9023d3883b3d51d90da3865bf5a873859
 * SoulClawVerifier: 0x0B0e2C1295985beF30c502B7D9A70910d8A98FE1 (oracle = deployer)
 * Token #0 already minted by deployer
 */
import { createPublicClient, createWalletClient, http, keccak256, encodePacked, getAddress } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { readFileSync } from "fs";

const DEPLOYER_KEY = process.env.DEPLOYER_KEY;
if (!DEPLOYER_KEY) { console.error("Set DEPLOYER_KEY"); process.exit(1); }

const deployer = privateKeyToAccount(DEPLOYER_KEY);
const receiverKey = generatePrivateKey();
const receiver = privateKeyToAccount(receiverKey);

const rpc = "https://sepolia.base.org";
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
const deployerWallet = createWalletClient({ account: deployer, chain: baseSepolia, transport: http(rpc) });
const receiverWallet = createWalletClient({ account: receiver, chain: baseSepolia, transport: http(rpc) });

const SOULCLAW_ADDR = "0x57f3a2b9023d3883b3d51d90da3865bf5a873859";
const abi = JSON.parse(readFileSync("artifacts/contracts/SoulClawV3.sol/SoulClawV3.json", "utf8")).abi;

async function main() {
  console.log("=== iTransfer E2E on Base Sepolia ===\n");
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Receiver: ${receiver.address}`);
  console.log(`Contract: ${SOULCLAW_ADDR}\n`);

  // Read current state
  const owner0 = await publicClient.readContract({ address: SOULCLAW_ADDR, abi, functionName: "ownerOf", args: [0n] });
  const soul0 = await publicClient.readContract({ address: SOULCLAW_ADDR, abi, functionName: "getSoulData", args: [0n] });
  console.log(`Token #0 owner: ${owner0}`);
  console.log(`Token #0 dataHash: ${soul0.dataHash}`);
  console.log(`Token #0 version: ${soul0.version}\n`);

  // Build proof
  const oldDataHash = soul0.dataHash;
  const newDataHash = keccak256(encodePacked(["string"], ["soul-reencrypted-for-receiver-" + Date.now()]));
  const sealedKey = keccak256(encodePacked(["string"], ["sealed-key-" + Date.now()]));
  const nonce = keccak256(encodePacked(["string", "uint256"], ["nonce", BigInt(Date.now())]));

  console.log("Building proof...");

  // Receiver signs access proof: hash(oldDataHash, newDataHash, nonce)
  const accessMsg = keccak256(encodePacked(["bytes32", "bytes32", "bytes"], [oldDataHash, newDataHash, nonce]));
  const accessProof = await receiverWallet.signMessage({ message: { raw: accessMsg } });
  console.log("  Receiver signed access proof");

  // Oracle (deployer) signs ownership proof: hash(oldDataHash, newDataHash, sealedKey, nonce)
  const ownershipMsg = keccak256(encodePacked(["bytes32", "bytes32", "bytes", "bytes"], [oldDataHash, newDataHash, sealedKey, nonce]));
  const ownershipProof = await deployerWallet.signMessage({ message: { raw: ownershipMsg } });
  console.log("  Oracle signed ownership proof");

  const proof = {
    accessProof,
    ownershipProof,
    oldDataHash,
    newDataHash,
    sealedKey,
    targetPubkey: "0x",
    wantedKey: "0x",
    nonce,
  };

  // Execute iTransferFrom
  console.log("\nExecuting iTransferFrom...");
  const nonceTx = await publicClient.getTransactionCount({ address: deployer.address, blockTag: "pending" });
  const hash = await deployerWallet.writeContract({
    address: SOULCLAW_ADDR,
    abi,
    functionName: "iTransferFrom",
    args: [deployer.address, receiver.address, 0n, [proof]],
    nonce: nonceTx,
  });
  console.log(`  tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  status: ${receipt.status}`);

  // Wait a bit for RPC to update
  await new Promise(r => setTimeout(r, 3000));

  // Verify
  console.log("\nVerifying...");
  const newOwner = await publicClient.readContract({ address: SOULCLAW_ADDR, abi, functionName: "ownerOf", args: [0n] });
  const newSoul = await publicClient.readContract({ address: SOULCLAW_ADDR, abi, functionName: "getSoulData", args: [0n] });

  console.log(`  New owner: ${newOwner}`);
  console.log(`  Expected:  ${receiver.address}`);
  const ownerOk = getAddress(newOwner) === getAddress(receiver.address);
  console.log(`  Match: ${ownerOk}`);
  console.log(`  New dataHash: ${newSoul.dataHash}`);
  console.log(`  Expected:     ${newDataHash}`);
  const hashOk = newSoul.dataHash === newDataHash;
  console.log(`  Match: ${hashOk}`);
  console.log(`  Version: ${newSoul.version}`);

  if (ownerOk && hashOk) {
    console.log("\n=== SUCCESS: iTransfer with ECDSA verification PASSED on Base Sepolia ===");
    console.log(`  https://sepolia.basescan.org/tx/${hash}`);
  } else {
    console.log("\n=== FAILED ===");
    process.exit(1);
  }
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
