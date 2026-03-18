import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { decrypt } from "@/lib/server-crypto";
import { downloadFromStorage } from "@/lib/storage";
import { getTokenIdForOwner, getSoulData } from "@/lib/chain";
import { type Address } from "viem";

const DEFAULT_PASSPHRASE = process.env.SOULCLAW_DEFAULT_PASSPHRASE || "soulclaw-test-v1";

export async function POST(request: NextRequest) {
  const keyInfo = validateApiKey(request);
  if (!keyInfo) {
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    );
  }

  try {
    let passphrase = DEFAULT_PASSPHRASE;
    let arweaveTxId: string | undefined;

    try {
      const body = await request.json();
      if (body.passphrase) passphrase = body.passphrase;
      if (body.arweaveTxId) arweaveTxId = body.arweaveTxId;
    } catch {
      // No body or not JSON, use defaults
    }

    // If no txId provided, look it up from chain
    if (!arweaveTxId) {
      const walletAddr = keyInfo.walletAddress as Address;
      const tokenId = await getTokenIdForOwner(walletAddr);
      if (!tokenId) {
        return NextResponse.json(
          { error: "No soul found for this wallet. Back up first." },
          { status: 404 }
        );
      }

      const soulData = await getSoulData(tokenId) as unknown as {
        arweaveTxId: string;
      };
      arweaveTxId = soulData.arweaveTxId;
      if (!arweaveTxId) {
        return NextResponse.json(
          { error: "Soul exists but no Arweave data found." },
          { status: 404 }
        );
      }
    }

    // Download encrypted data
    const encryptedData = await downloadFromStorage(arweaveTxId);

    // Decrypt
    const decryptedData = await decrypt(encryptedData, passphrase);

    // Return as downloadable tar.gz
    return new Response(new Uint8Array(decryptedData), {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="soul-restore-${Date.now()}.tar.gz"`,
        "X-Wallet": keyInfo.walletAddress,
        "X-Arweave-TxId": arweaveTxId,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `Failed to restore: ${msg}` }, { status: 500 });
  }
}
