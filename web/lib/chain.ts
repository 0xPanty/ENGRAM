import { createPublicClient, createWalletClient, http, type Address, type Hash } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { SOULCLAW_ABI, SOULCLAW_ADDRESS } from "./contract";

const chain = baseSepolia;
const transport = http(process.env.BASE_RPC_URL || "https://sepolia.base.org");

const publicClient = createPublicClient({ chain, transport });

function getWalletClient() {
  const pk = process.env.OPERATOR_PRIVATE_KEY;
  if (!pk) throw new Error("OPERATOR_PRIVATE_KEY not set");
  const account = privateKeyToAccount(pk as `0x${string}`);
  return createWalletClient({ account, chain, transport });
}

export async function hasMinted(address: Address): Promise<boolean> {
  return publicClient.readContract({
    address: SOULCLAW_ADDRESS,
    abi: SOULCLAW_ABI,
    functionName: "hasMinted",
    args: [address],
  }) as Promise<boolean>;
}

export async function getMintPrice(): Promise<bigint> {
  return publicClient.readContract({
    address: SOULCLAW_ADDRESS,
    abi: SOULCLAW_ABI,
    functionName: "mintPrice",
  }) as Promise<bigint>;
}

export async function getSoulData(tokenId: bigint) {
  return publicClient.readContract({
    address: SOULCLAW_ADDRESS,
    abi: SOULCLAW_ABI,
    functionName: "getSoulData",
    args: [tokenId],
  });
}

export async function getTokenIdForOwner(address: Address): Promise<bigint | null> {
  const balance = (await publicClient.readContract({
    address: SOULCLAW_ADDRESS,
    abi: SOULCLAW_ABI,
    functionName: "balanceOf",
    args: [address],
  })) as bigint;

  if (balance === 0n) return null;

  // SoulClaw is 1-per-address, scan from tokenId 1
  const totalSupply = (await publicClient.readContract({
    address: SOULCLAW_ADDRESS,
    abi: SOULCLAW_ABI,
    functionName: "totalSupply",
  })) as bigint;

  for (let i = 1n; i <= totalSupply; i++) {
    try {
      const owner = (await publicClient.readContract({
        address: SOULCLAW_ADDRESS,
        abi: SOULCLAW_ABI,
        functionName: "ownerOf",
        args: [i],
      })) as Address;
      if (owner.toLowerCase() === address.toLowerCase()) return i;
    } catch {
      continue;
    }
  }
  return null;
}

export async function mintSoul(params: {
  dataHash: `0x${string}`;
  arweaveTxId: string;
  imageUri: string;
  soulSummary: string;
  soulStatement: string;
  skills: string[];
}): Promise<{ txHash: Hash; tokenId: bigint }> {
  const wallet = getWalletClient();
  const mintPrice = await getMintPrice();

  const txHash = await wallet.writeContract({
    address: SOULCLAW_ADDRESS,
    abi: SOULCLAW_ABI,
    functionName: "mintSoul",
    args: [
      params.dataHash as `0x${string}`,
      params.arweaveTxId,
      params.imageUri,
      params.soulSummary,
      params.soulStatement,
      params.skills,
    ],
    value: mintPrice,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  // Parse SoulMinted event to get tokenId
  const mintEvent = receipt.logs.find(
    (log) => log.topics[0] === "0x" // Will be matched by topic
  );

  // tokenId is the first indexed param in SoulMinted event
  const tokenId = mintEvent?.topics[1]
    ? BigInt(mintEvent.topics[1])
    : 1n;

  return { txHash, tokenId };
}

export async function updateSoul(params: {
  tokenId: bigint;
  newDataHash: `0x${string}`;
  newArweaveTxId: string;
  newImageUri: string;
  newSoulSummary: string;
  newSoulStatement: string;
}): Promise<Hash> {
  const wallet = getWalletClient();

  return wallet.writeContract({
    address: SOULCLAW_ADDRESS,
    abi: SOULCLAW_ABI,
    functionName: "updateSoul",
    args: [
      params.tokenId,
      params.newDataHash as `0x${string}`,
      params.newArweaveTxId,
      params.newImageUri,
      params.newSoulSummary,
      params.newSoulStatement,
    ],
  });
}
