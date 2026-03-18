import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

export interface StorageResult {
  txId: string;
  url: string;
}

const ZG_RPC_URL = process.env.ZG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const ZG_INDEXER_RPC = process.env.ZG_INDEXER_RPC || "https://indexer-storage-testnet-turbo.0g.ai";
const ZG_PRIVATE_KEY = process.env.ZG_PRIVATE_KEY || process.env.OPERATOR_PRIVATE_KEY;

const USE_0G = !!ZG_PRIVATE_KEY && process.env.STORAGE_BACKEND !== "memory";

const memoryStore = new Map<string, Buffer>();

export async function uploadToStorage(data: Buffer, tags?: Record<string, string>): Promise<StorageResult> {
  if (USE_0G) {
    return uploadTo0G(data);
  }
  return uploadToMemory(data);
}

export async function downloadFromStorage(txId: string): Promise<Buffer> {
  if (USE_0G) {
    return downloadFrom0G(txId);
  }
  return downloadFromMemory(txId);
}

// --- 0G Storage implementation ---

async function uploadTo0G(data: Buffer): Promise<StorageResult> {
  const { ZgFile, Indexer } = await import("@0gfoundation/0g-ts-sdk");
  const { ethers } = await import("ethers");

  const provider = new ethers.JsonRpcProvider(ZG_RPC_URL);
  const signer = new ethers.Wallet(ZG_PRIVATE_KEY!, provider);
  const indexer = new Indexer(ZG_INDEXER_RPC);

  // Write to temp file (SDK requires file path)
  const tmpDir = join(tmpdir(), "soulclaw");
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
  const tmpFile = join(tmpDir, `upload_${Date.now()}.bin`);

  try {
    writeFileSync(tmpFile, data);

    const zgFile = await ZgFile.fromFilePath(tmpFile);
    const [tree, treeErr] = await zgFile.merkleTree();
    if (treeErr) throw new Error(`Merkle tree error: ${treeErr}`);

    const rootHash = tree!.rootHash()!;

    const [tx, uploadErr] = await indexer.upload(zgFile, ZG_RPC_URL, signer as any);
    if (uploadErr) throw new Error(`0G upload error: ${uploadErr}`);

    await zgFile.close();

    return {
      txId: rootHash,
      url: `0g://${rootHash}`,
    };
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

async function downloadFrom0G(rootHash: string): Promise<Buffer> {
  const { Indexer } = await import("@0gfoundation/0g-ts-sdk");

  const indexer = new Indexer(ZG_INDEXER_RPC);

  const tmpDir = join(tmpdir(), "soulclaw");
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
  const tmpFile = join(tmpDir, `download_${Date.now()}.bin`);

  try {
    const err = await indexer.download(rootHash, tmpFile, true);
    if (err) throw new Error(`0G download error: ${err}`);

    return readFileSync(tmpFile);
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

// --- Memory mock (for local dev / testing without 0G token) ---

function uploadToMemory(data: Buffer): StorageResult {
  const txId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  memoryStore.set(txId, Buffer.from(data));
  return {
    txId,
    url: `memory://${txId}`,
  };
}

function downloadFromMemory(txId: string): Buffer {
  const data = memoryStore.get(txId);
  if (!data) {
    throw new Error(`Mock storage: txId ${txId} not found. Data may have been lost on redeploy.`);
  }
  return data;
}
