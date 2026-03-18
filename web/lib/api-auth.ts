import { NextRequest } from "next/server";

interface ApiKeyInfo {
  walletAddress: string;
  tokenId?: number;
}

// Phase 1: 用环境变量存固定 API Key，Serverless 友好
// Phase 2: 换成数据库
const STATIC_KEYS: Record<string, ApiKeyInfo> = {};

// 从环境变量加载预设 Key
// 格式: SOULCLAW_STATIC_KEY=sc_xxx:0xWalletAddress
const staticKeyEnv = process.env.SOULCLAW_STATIC_KEY;
if (staticKeyEnv) {
  const [key, wallet] = staticKeyEnv.split(":");
  if (key && wallet) {
    STATIC_KEYS[key] = { walletAddress: wallet };
  }
}

const RUNTIME_KEYS = new Map<string, ApiKeyInfo>();

export function generateApiKey(walletAddress: string): string {
  const random = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const key = `sc_${walletAddress.toLowerCase().slice(2, 10)}_${random}`;
  RUNTIME_KEYS.set(key, { walletAddress });
  return key;
}

export function validateApiKey(request: NextRequest): ApiKeyInfo | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const key = authHeader.slice(7);
  return STATIC_KEYS[key] ?? RUNTIME_KEYS.get(key) ?? null;
}

export function setTokenId(apiKey: string, tokenId: number): void {
  const info = STATIC_KEYS[apiKey] ?? RUNTIME_KEYS.get(apiKey);
  if (info) info.tokenId = tokenId;
}
