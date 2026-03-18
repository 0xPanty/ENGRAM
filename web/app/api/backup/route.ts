import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";

/**
 * POST /api/backup
 *
 * 接收 Agent 上传的 tar.gz 备份包。
 * 服务端处理：加密 -> 上传 Arweave -> mint/update NFT
 *
 * Phase 1: 接收文件，返回成功（加密和上链逻辑待接入）
 * Phase 2: 完整加密 + Arweave + NFT 流程
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
    const formData = await request.formData();
    const backupFile = formData.get("backup") as File | null;

    if (!backupFile) {
      return NextResponse.json({ error: "No backup file provided" }, { status: 400 });
    }

    const bytes = await backupFile.arrayBuffer();
    const sizeKB = Math.round(bytes.byteLength / 1024);

    // TODO Phase 2: 实际流程
    // 1. 用用户提供的 passphrase + wallet signature 加密数据
    // 2. 上传加密数据到 Arweave (Irys SDK)
    // 3. 计算 dataHash = SHA256(encrypted)
    // 4. 调用合约 mintSoul() 或 updateSoul()
    // 5. 返回 tokenId + txHash

    // Phase 1: 模拟成功响应
    return NextResponse.json({
      success: true,
      message: "Soul backup received",
      wallet: keyInfo.walletAddress,
      size: `${sizeKB} KB`,
      // 以下字段在 Phase 2 会填入真实值
      tokenId: keyInfo.tokenId ?? null,
      arweaveTxId: null,
      txHash: null,
      version: 1,
    });
  } catch {
    return NextResponse.json({ error: "Failed to process backup" }, { status: 500 });
  }
}
