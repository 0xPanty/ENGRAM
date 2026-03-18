import Arweave from "arweave";

export interface StorageResult {
  txId: string;
  url: string;
}

const USE_ARWEAVE = !!process.env.ARWEAVE_KEY;

const memoryStore = new Map<string, Buffer>();

export async function uploadToStorage(data: Buffer, tags?: Record<string, string>): Promise<StorageResult> {
  if (USE_ARWEAVE) {
    return uploadToArweave(data, tags);
  }
  return uploadToMemory(data);
}

export async function downloadFromStorage(txId: string): Promise<Buffer> {
  if (USE_ARWEAVE) {
    return downloadFromArweave(txId);
  }
  return downloadFromMemory(txId);
}

// --- Arweave implementation ---

async function uploadToArweave(data: Buffer, tags?: Record<string, string>): Promise<StorageResult> {
  const arweave = Arweave.init({
    host: "arweave.net",
    port: 443,
    protocol: "https",
  });

  const key = JSON.parse(process.env.ARWEAVE_KEY!);
  const tx = await arweave.createTransaction({ data }, key);

  tx.addTag("Content-Type", "application/octet-stream");
  tx.addTag("App-Name", "SoulClaw");
  tx.addTag("App-Version", "1.0");
  if (tags) {
    for (const [k, v] of Object.entries(tags)) {
      tx.addTag(k, v);
    }
  }

  await arweave.transactions.sign(tx, key);
  const response = await arweave.transactions.post(tx);

  if (response.status !== 200 && response.status !== 202) {
    throw new Error(`Arweave upload failed: ${response.status}`);
  }

  return {
    txId: tx.id,
    url: `https://arweave.net/${tx.id}`,
  };
}

async function downloadFromArweave(txId: string): Promise<Buffer> {
  const response = await fetch(`https://arweave.net/${txId}`);
  if (!response.ok) {
    throw new Error(`Arweave download failed: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

// --- Memory mock (for testing without Arweave) ---

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
