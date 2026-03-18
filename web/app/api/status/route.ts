import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";

/**
 * GET /api/status
 *
 * 返回用户灵魂的链上状态信息
 */
export async function GET(request: NextRequest) {
  const keyInfo = validateApiKey(request);
  if (!keyInfo) {
    return NextResponse.json(
      { error: "Invalid or missing API key. Get one at https://soulclaw.xyz" },
      { status: 401 }
    );
  }

  try {
    // TODO Phase 2: 从链上读取真实数据
    // const soulData = await readContract({ functionName: 'getSoulData', args: [tokenId] })

    if (!keyInfo.tokenId) {
      return NextResponse.json({
        hasSoul: false,
        wallet: keyInfo.walletAddress,
        message: "No soul minted yet. Run a backup first.",
      });
    }

    // Phase 1: 返回模拟数据
    return NextResponse.json({
      hasSoul: true,
      wallet: keyInfo.walletAddress,
      tokenId: keyInfo.tokenId,
      version: 1,
      lastUpdated: Math.floor(Date.now() / 1000),
      skills: [],
      dataSize: "0 KB",
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
  }
}
