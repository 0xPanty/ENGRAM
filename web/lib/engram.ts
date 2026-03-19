/**
 * Engram 多版本系统
 *
 * 每次备份 = 刻印一道 Engram。旧版本不删除，可回溯。
 * 版本索引 (engram-index.json) 存储在 0G Storage，
 * 其 rootHash 编码在 NFT 的 soulSummary 字段中。
 */

import { uploadToStorage, downloadFromStorage } from "./storage";

export interface EngramEntry {
  version: number;
  tag: string;
  storeTxId: string;
  dataHash: string;
  timestamp: number;
  sizeBytes: number;
}

export interface EngramIndex {
  wallet: string;
  tokenId: number;
  engrams: EngramEntry[];
}

const INDEX_PREFIX = "ENGRAM_IDX:";

export function encodeIndexPointer(indexTxId: string, humanSummary: string): string {
  return `${INDEX_PREFIX}${indexTxId}|${humanSummary}`;
}

export function decodeIndexPointer(soulSummary: string): { indexTxId: string | null; humanSummary: string } {
  if (soulSummary.startsWith(INDEX_PREFIX)) {
    const rest = soulSummary.slice(INDEX_PREFIX.length);
    const pipeIdx = rest.indexOf("|");
    if (pipeIdx >= 0) {
      return {
        indexTxId: rest.slice(0, pipeIdx),
        humanSummary: rest.slice(pipeIdx + 1),
      };
    }
    return { indexTxId: rest, humanSummary: "" };
  }
  return { indexTxId: null, humanSummary: soulSummary };
}

export async function loadEngramIndex(indexTxId: string): Promise<EngramIndex | null> {
  try {
    const data = await downloadFromStorage(indexTxId);
    return JSON.parse(data.toString("utf-8"));
  } catch {
    return null;
  }
}

export async function saveEngramIndex(index: EngramIndex): Promise<string> {
  const data = Buffer.from(JSON.stringify(index, null, 2), "utf-8");
  const result = await uploadToStorage(data, { "Content-Type": "application/json" });
  return result.txId;
}

export function appendEngram(
  index: EngramIndex | null,
  wallet: string,
  tokenId: number,
  entry: EngramEntry
): EngramIndex {
  if (index) {
    return {
      ...index,
      engrams: [...index.engrams, entry],
    };
  }
  return {
    wallet,
    tokenId,
    engrams: [entry],
  };
}
