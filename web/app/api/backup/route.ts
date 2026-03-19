import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { validateApiKey } from "@/lib/api-auth";
import { uploadToStorage } from "@/lib/storage";
import { hasMinted, mintSoulFor, updateSoulFor, getTokenIdForOwner, getSoulData } from "@/lib/chain";
import { type Address } from "viem";
import {
  type EngramEntry,
  encodeIndexPointer,
  decodeIndexPointer,
  loadEngramIndex,
  saveEngramIndex,
  appendEngram,
} from "@/lib/engram";

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
    const clientDataHash = formData.get("dataHash") as string | null;
    const engramTag = (formData.get("tag") as string | null) || `Engram ${new Date().toISOString()}`;

    if (!backupFile) {
      return NextResponse.json({ error: "No backup file provided" }, { status: 400 });
    }

    // 服务器接收的是客户端已加密的密文, 不做任何加解密
    const encryptedData = Buffer.from(await backupFile.arrayBuffer());
    const sizeKB = Math.round(encryptedData.byteLength / 1024);

    // 服务端校验: 重新计算 SHA-256, 与客户端提供的 dataHash 比对
    const serverHash = "0x" + createHash("sha256").update(encryptedData).digest("hex");
    const dataHash = clientDataHash || serverHash;

    if (clientDataHash && clientDataHash !== serverHash) {
      return NextResponse.json(
        { error: "dataHash mismatch: uploaded data does not match declared hash" },
        { status: 400 }
      );
    }

    // 1. Upload to storage (encrypted blob as-is)
    const storageResult = await uploadToStorage(encryptedData, {
      "Soul-Owner": keyInfo.walletAddress,
      "Data-Hash": dataHash,
    });

    // 2. Write on-chain (mint or update) + maintain engram index
    let txHash: string | null = null;
    let tokenId: bigint | null = null;
    let onChainError: string | null = null;
    let engramVersion = 1;
    let indexTxId: string | null = null;

    try {
      const walletAddr = keyInfo.walletAddress as Address;
      const alreadyMinted = await hasMinted(walletAddr);

      if (alreadyMinted) {
        tokenId = await getTokenIdForOwner(walletAddr);
        if (tokenId !== null) {
          // Load existing engram index from chain -> 0G
          let existingIndex = null;
          try {
            const soulData = await getSoulData(tokenId) as unknown as {
              soulSummary: string;
              version: bigint;
            };
            engramVersion = Number(soulData.version) + 1;
            const { indexTxId: existingIndexTxId } = decodeIndexPointer(soulData.soulSummary);
            if (existingIndexTxId) {
              existingIndex = await loadEngramIndex(existingIndexTxId);
            }
          } catch { /* first time with engram system, no index yet */ }

          // Build new engram entry
          const newEntry: EngramEntry = {
            version: engramVersion,
            tag: engramTag,
            storeTxId: storageResult.txId,
            dataHash,
            timestamp: Math.floor(Date.now() / 1000),
            sizeBytes: encryptedData.byteLength,
          };

          const updatedIndex = appendEngram(
            existingIndex,
            keyInfo.walletAddress,
            Number(tokenId),
            newEntry
          );

          indexTxId = await saveEngramIndex(updatedIndex);
          const soulSummary = encodeIndexPointer(indexTxId, `Engram v${engramVersion}: ${engramTag}`);

          txHash = await updateSoulFor({
            soulOwner: walletAddr,
            tokenId,
            newDataHash: dataHash as `0x${string}`,
            newArweaveTxId: storageResult.txId,
            newImageUri: "",
            newSoulSummary: soulSummary,
            newSoulStatement: "",
          });
        }
      } else {
        // First mint: create initial engram index
        const newEntry: EngramEntry = {
          version: 1,
          tag: engramTag,
          storeTxId: storageResult.txId,
          dataHash,
          timestamp: Math.floor(Date.now() / 1000),
          sizeBytes: encryptedData.byteLength,
        };

        const newIndex = appendEngram(
          null,
          keyInfo.walletAddress,
          0, // tokenId unknown until mint
          newEntry
        );

        indexTxId = await saveEngramIndex(newIndex);
        const soulSummary = encodeIndexPointer(indexTxId, `Engram v1: ${engramTag}`);

        const result = await mintSoulFor({
          toAddress: walletAddr,
          dataHash: dataHash as `0x${string}`,
          arweaveTxId: storageResult.txId,
          imageUri: "",
          soulSummary,
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
      message: "Soul backup complete (zero-knowledge: server never saw plaintext)",
      wallet: keyInfo.walletAddress,
      size: `${sizeKB} KB (encrypted)`,
      dataHash,
      storeTxId: storageResult.txId,
      storeUrl: storageResult.url,
      tokenId: tokenId !== null ? Number(tokenId) : null,
      txHash,
      engramVersion,
      engramTag,
      indexTxId,
      onChainError,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `Failed to process backup: ${msg}` }, { status: 500 });
  }
}
