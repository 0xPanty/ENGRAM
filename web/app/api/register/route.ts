import { NextRequest, NextResponse } from "next/server";
import { generateApiKey } from "@/lib/api-auth";

/**
 * POST /api/register
 *
 * 用户连钱包后调用，生成 API Key
 * Body: { walletAddress: "0x..." }
 */
export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json();

    if (!walletAddress || typeof walletAddress !== "string" || !walletAddress.startsWith("0x")) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    const apiKey = generateApiKey(walletAddress);

    return NextResponse.json({
      apiKey,
      message: "Set this as your SOULCLAW_API_KEY environment variable",
      instructions: `export SOULCLAW_API_KEY="${apiKey}"`,
    });
  } catch {
    return NextResponse.json({ error: "Failed to register" }, { status: 500 });
  }
}
