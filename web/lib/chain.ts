import { createPublicClient, createWalletClient, http, parseEventLogs, type Address, type Hash } from "viem";
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

  const totalSupply = (await publicClient.readContract({
    address: SOULCLAW_ADDRESS,
    abi: SOULCLAW_ABI,
    functionName: "totalSupply",
  })) as bigint;

  // tokenId 从 0 开始, totalSupply 是已铸造数量
  for (let i = 0n; i < totalSupply; i++) {
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

// OPERATOR 代用户 mint, NFT 归属 toAddress
export async function mintSoulFor(params: {
  toAddress: Address;
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
    functionName: "mintSoulFor",
    args: [
      params.toAddress,
      params.dataHash,
      params.arweaveTxId,
      params.imageUri,
      params.soulSummary,
      params.soulStatement,
      params.skills,
    ],
    value: mintPrice,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  const events = parseEventLogs({
    abi: SOULCLAW_ABI,
    logs: receipt.logs,
    eventName: "SoulMinted",
  });

  const tokenId = events.length > 0 ? (events[0].args as { tokenId: bigint }).tokenId : 0n;

  return { txHash, tokenId };
}

// OPERATOR 代用户更新灵魂数据
export async function updateSoulFor(params: {
  soulOwner: Address;
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
    functionName: "updateSoulFor",
    args: [
      params.soulOwner,
      params.tokenId,
      params.newDataHash,
      params.newArweaveTxId,
      params.newImageUri,
      params.newSoulSummary,
      params.newSoulStatement,
    ],
  });
}
