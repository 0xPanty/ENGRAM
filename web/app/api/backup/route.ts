import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { encrypt, computeDataHash } from "@/lib/server-crypto";
import { uploadToStorage } from "@/lib/storage";
import { hasMinted, mintSoul, updateSoul, getTokenIdForOwner } from "@/lib/chain";
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
    const formData = await request.formData();
    const backupFile = formData.get("backup") as File | null;
    const passphrase = (formData.get("passphrase") as string) || DEFAULT_PASSPHRASE;

    if (!backupFile) {
      return NextResponse.json({ error: "No backup file provided" }, { status: 400 });
    }

    const plainData = Buffer.from(await backupFile.arrayBuffer());
    const sizeKB = Math.round(plainData.byteLength / 1024);

    // 1. Encrypt
    const { encrypted, dataHash } = await encrypt(plainData, passphrase);

    // 2. Upload to storage (Arweave or mock)
    const storageResult = await uploadToStorage(encrypted, {
      "Soul-Owner": keyInfo.walletAddress,
      "Data-Hash": dataHash,
    });

    // 3. Write on-chain (mint or update)
    let txHash: string | null = null;
    let tokenId: bigint | null = null;
    let onChainError: string | null = null;

    try {
      const walletAddr = keyInfo.walletAddress as Address;
      const alreadyMinted = await hasMinted(walletAddr);

      if (alreadyMinted) {
        tokenId = await getTokenIdForOwner(walletAddr);
        if (tokenId) {
          txHash = await updateSoul({
            tokenId,
            newDataHash: dataHash as `0x${string}`,
            newArweaveTxId: storageResult.txId,
            newImageUri: "",
            newSoulSummary: `Soul backup ${new Date().toISOString()}`,
            newSoulStatement: "",
          });
        }
      } else {
        const result = await mintSoul({
          dataHash: dataHash as `0x${string}`,
          arweaveTxId: storageResult.txId,
          imageUri: "",
          soulSummary: `Soul backup ${new Date().toISOString()}`,
          soulStatement: "My AI soul, on-chain forever.",
          skills: [],
        });
        txHash = result.txHash;
        tokenId = result.tokenId;
      }
    } catch (e) {
      onChainError = e instanceof Error ? e.message : String(e);
    }

    return NextResponse.json({
      success: true,
      message: "Soul backup complete",
      wallet: keyInfo.walletAddress,
      size: `${sizeKB} KB`,
      dataHash,
      arweaveTxId: storageResult.txId,
      arweaveUrl: storageResult.url,
      tokenId: tokenId ? Number(tokenId) : null,
      txHash,
      onChainError,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `Failed to process backup: ${msg}` }, { status: 500 });
  }
}
