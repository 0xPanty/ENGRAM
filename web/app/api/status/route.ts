import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { getTokenIdForOwner, getSoulData } from "@/lib/chain";
import { type Address } from "viem";

export async function GET(request: NextRequest) {
  const keyInfo = validateApiKey(request);
  if (!keyInfo) {
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    );
  }

  try {
    const walletAddr = keyInfo.walletAddress as Address;
    const tokenId = await getTokenIdForOwner(walletAddr);

    if (!tokenId) {
      return NextResponse.json({
        hasSoul: false,
        wallet: keyInfo.walletAddress,
        message: "No soul minted yet. Run a backup first.",
      });
    }

    const raw = await getSoulData(tokenId);
    const soulData = raw as unknown as {
      dataHash: string;
      arweaveTxId: string;
      imageUri: string;
      soulSummary: string;
      soulStatement: string;
      skills: string[];
      version: bigint;
      lastUpdated: bigint;
    };
    const { dataHash, arweaveTxId, imageUri, soulSummary, soulStatement, skills, version, lastUpdated } = soulData;

    return NextResponse.json({
      hasSoul: true,
      wallet: keyInfo.walletAddress,
      tokenId: Number(tokenId),
      dataHash,
      arweaveTxId,
      arweaveUrl: arweaveTxId ? `https://arweave.net/${arweaveTxId}` : null,
      imageUri,
      soulSummary,
      soulStatement,
      skills,
      version: Number(version),
      lastUpdated: Number(lastUpdated),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `Failed to fetch status: ${msg}` }, { status: 500 });
  }
}
