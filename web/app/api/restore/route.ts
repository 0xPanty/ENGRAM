import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { validateApiKey } from "@/lib/api-auth";
import { downloadFromStorage } from "@/lib/storage";
import { getTokenIdForOwner, getSoulData } from "@/lib/chain";
import { type Address } from "viem";

export async function POST(request: NextRequest) {
  const keyInfo = validateApiKey(request);
  if (!keyInfo) {
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    );
  }

  try {
    let storeTxId: string | undefined;
    let expectedDataHash: string | undefined;

    try {
      const body = await request.json();
      if (body.storeTxId) storeTxId = body.storeTxId;
    } catch {
      // No body or not JSON
    }

    // If no txId provided, look it up from chain
    if (!storeTxId) {
      const walletAddr = keyInfo.walletAddress as Address;
      const tokenId = await getTokenIdForOwner(walletAddr);
      if (tokenId === null) {
        return NextResponse.json(
          { error: "No soul found for this wallet. Back up first." },
          { status: 404 }
        );
      }

      const soulData = await getSoulData(tokenId) as unknown as {
        arweaveTxId: string;
        dataHash: string;
      };
      storeTxId = soulData.arweaveTxId;
      expectedDataHash = soulData.dataHash;

      if (!storeTxId) {
        return NextResponse.json(
          { error: "Soul exists but no storage data found." },
          { status: 404 }
        );
      }
    }

    // Download encrypted data (server never decrypts, client does)
    const encryptedData = await downloadFromStorage(storeTxId);

    // Verify integrity against on-chain dataHash if available
    if (expectedDataHash) {
      const downloadHash = "0x" + createHash("sha256").update(encryptedData).digest("hex");
      if (downloadHash !== expectedDataHash) {
        return NextResponse.json(
          { error: "Data integrity check failed: downloaded data hash does not match on-chain record" },
          { status: 500 }
        );
      }
    }

    // Return encrypted blob as-is (client decrypts locally)
    return new Response(new Uint8Array(encryptedData), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="soul-encrypted-${Date.now()}.bin"`,
        "X-Wallet": keyInfo.walletAddress,
        "X-Store-TxId": storeTxId,
        "X-Data-Hash": expectedDataHash ?? "",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `Failed to restore: ${msg}` }, { status: 500 });
  }
}
