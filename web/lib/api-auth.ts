import { NextRequest } from "next/server";

/**
 * API Key 格式: sc_{walletAddress}_{randomHex}
 * 在用户注册时生成，存储在数据库中（Phase 1 用内存/文件存储）
 */

interface ApiKeyInfo {
  walletAddress: string;
  tokenId?: number;
}

// Phase 1: 简单的内存存储，生产环境换成数据库
const API_KEYS = new Map<string, ApiKeyInfo>();

export function generateApiKey(walletAddress: string): string {
  const random = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const key = `sc_${walletAddress.toLowerCase().slice(2, 10)}_${random}`;
  API_KEYS.set(key, { walletAddress });
  return key;
}

export function validateApiKey(request: NextRequest): ApiKeyInfo | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const key = authHeader.slice(7);
  return API_KEYS.get(key) ?? null;
}

export function setTokenId(apiKey: string, tokenId: number): void {
  const info = API_KEYS.get(apiKey);
  if (info) info.tokenId = tokenId;
}
