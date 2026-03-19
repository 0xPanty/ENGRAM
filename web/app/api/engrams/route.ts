import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { getTokenIdForOwner, getSoulData } from "@/lib/chain";
import { decodeIndexPointer, loadEngramIndex } from "@/lib/engram";
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

    if (tokenId === null) {
      return NextResponse.json({
        wallet: keyInfo.walletAddress,
        engrams: [],
        message: "No soul found. Run a backup first.",
      });
    }

    const raw = await getSoulData(tokenId);
    const soulData = raw as unknown as {
      soulSummary: string;
      version: bigint;
      lastUpdated: bigint;
    };

    const { indexTxId, humanSummary } = decodeIndexPointer(soulData.soulSummary);

    if (!indexTxId) {
      // Pre-engram backup (no index yet), return single entry from chain state
      return NextResponse.json({
        wallet: keyInfo.walletAddress,
        tokenId: Number(tokenId),
        currentVersion: Number(soulData.version),
        summary: humanSummary,
        engrams: [],
        message: "Soul exists but no engram index found. Backups made before the engram system have no version history.",
      });
    }

    const index = await loadEngramIndex(indexTxId);

    if (!index) {
      return NextResponse.json({
        wallet: keyInfo.walletAddress,
        tokenId: Number(tokenId),
        currentVersion: Number(soulData.version),
        engrams: [],
        message: "Failed to load engram index from storage.",
      });
    }

    return NextResponse.json({
      wallet: keyInfo.walletAddress,
      tokenId: Number(tokenId),
      currentVersion: Number(soulData.version),
      lastUpdated: Number(soulData.lastUpdated),
      engrams: index.engrams,
      totalEngrams: index.engrams.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `Failed to fetch engrams: ${msg}` }, { status: 500 });
  }
}
