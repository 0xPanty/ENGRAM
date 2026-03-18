import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";

/**
 * POST /api/restore
 *
 * 从 Arweave 下载加密数据 -> 解密 -> 返回 tar.gz
 *
 * Phase 1: 返回占位响应
 * Phase 2: 完整下载 + 解密流程
 */
export async function POST(request: NextRequest) {
  const keyInfo = validateApiKey(request);
  if (!keyInfo) {
    return NextResponse.json(
      { error: "Invalid or missing API key. Get one at https://soulclaw.xyz" },
      { status: 401 }
    );
  }

  try {
    // TODO Phase 2: 实际流程
    // 1. 从链上读取 tokenId -> arweaveTxId
    // 2. 从 Arweave 下载加密数据
    // 3. 用用户提供的 passphrase + wallet signature 解密
    // 4. 返回解密后的 tar.gz

    if (!keyInfo.tokenId) {
      return NextResponse.json(
        { error: "No soul found for this wallet. Back up first." },
        { status: 404 }
      );
    }

    // Phase 1: 返回状态信息
    return NextResponse.json({
      success: false,
      message: "Restore not yet implemented. Coming in Phase 2.",
      tokenId: keyInfo.tokenId,
    });
  } catch {
    return NextResponse.json({ error: "Failed to process restore" }, { status: 500 });
  }
}
