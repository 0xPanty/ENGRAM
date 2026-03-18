/**
 * SoulClaw 端到端测试脚本
 *
 * 测试流程:
 * 1. 创建测试数据 (模拟 tar.gz)
 * 2. 客户端本地加密 (scrypt + AES-256-GCM)
 * 3. 调用 backup API 上传密文
 * 4. 调用 restore API 下载密文
 * 5. 客户端本地解密
 * 6. 对比原始数据一致性
 *
 * 用法: node scripts/e2e-test.mjs [baseUrl]
 * 默认 baseUrl: http://localhost:3000
 */

import { randomBytes, createCipheriv, createDecipheriv, createHash, scryptSync } from "crypto";

const BASE_URL = process.argv[2] || "http://localhost:3000";
const API_KEY = process.env.SOULCLAW_API_KEY || process.env.SOULCLAW_STATIC_KEY?.split(":")[0];

if (!API_KEY) {
  console.error("ERROR: Set SOULCLAW_API_KEY or SOULCLAW_STATIC_KEY env var");
  process.exit(1);
}

const PASSPHRASE = "e2e-test-passphrase-" + Date.now();
const SCRYPT_N = 2 ** 14;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function log(step, msg) {
  console.log(`[${step}] ${msg}`);
}

function encrypt(plainData, passphrase) {
  const salt = randomBytes(32);
  const key = scryptSync(passphrase, salt, 32, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainData), cipher.final()]);
  const tag = cipher.getAuthTag();
  const pkg = Buffer.concat([salt, iv, encrypted, tag]);
  const dataHash = "0x" + createHash("sha256").update(pkg).digest("hex");
  return { encrypted: pkg, dataHash };
}

function decrypt(encryptedPkg, passphrase) {
  const salt = encryptedPkg.subarray(0, 32);
  const iv = encryptedPkg.subarray(32, 44);
  const tag = encryptedPkg.subarray(encryptedPkg.length - 16);
  const ciphertext = encryptedPkg.subarray(44, encryptedPkg.length - 16);
  const key = scryptSync(passphrase, salt, 32, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

async function main() {
  console.log("=== SoulClaw E2E Test ===");
  console.log(`API: ${BASE_URL}`);
  console.log(`Key: ${API_KEY.slice(0, 8)}...`);
  console.log();

  // Step 1: Create test data
  const testContent = `SOUL.md test content - ${new Date().toISOString()}\n` +
    "Personality: curious, analytical\n" +
    "Skills: Solidity, TypeScript\n" +
    randomBytes(256).toString("hex"); // pad to ~512 bytes
  const originalData = Buffer.from(testContent, "utf-8");
  log("1/6", `Created test data: ${originalData.byteLength} bytes`);

  // Step 2: Encrypt locally
  const { encrypted, dataHash } = encrypt(originalData, PASSPHRASE);
  log("2/6", `Encrypted: ${encrypted.byteLength} bytes, dataHash: ${dataHash.slice(0, 18)}...`);

  // Step 3: Upload to backup API
  const formData = new FormData();
  formData.append("backup", new Blob([encrypted]), "test-backup.bin");
  formData.append("dataHash", dataHash);

  log("3/6", "Calling POST /api/backup...");
  const backupRes = await fetch(`${BASE_URL}/api/backup`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: formData,
  });
  const backupJson = await backupRes.json();

  if (!backupRes.ok) {
    console.error("BACKUP FAILED:", backupJson);
    process.exit(1);
  }

  log("3/6", `Backup response:`);
  console.log(JSON.stringify(backupJson, null, 2));

  if (backupJson.dataHash !== dataHash) {
    console.error(`FAIL: dataHash mismatch! client=${dataHash} server=${backupJson.dataHash}`);
    process.exit(1);
  }
  log("3/6", "dataHash verified OK");

  // Step 4: Download from restore API
  log("4/6", "Calling POST /api/restore...");
  const restoreRes = await fetch(`${BASE_URL}/api/restore`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ storeTxId: backupJson.storeTxId }),
  });

  if (!restoreRes.ok) {
    const errBody = await restoreRes.text();
    console.error("RESTORE FAILED:", restoreRes.status, errBody);
    process.exit(1);
  }

  const restoredEncrypted = Buffer.from(await restoreRes.arrayBuffer());
  log("4/6", `Downloaded encrypted: ${restoredEncrypted.byteLength} bytes`);

  // Verify encrypted blob matches
  const restoredHash = "0x" + createHash("sha256").update(restoredEncrypted).digest("hex");
  if (restoredHash !== dataHash) {
    console.error(`FAIL: restored blob hash mismatch! expected=${dataHash} got=${restoredHash}`);
    process.exit(1);
  }
  log("4/6", "Encrypted blob hash verified OK");

  // Step 5: Decrypt locally
  const decryptedData = decrypt(restoredEncrypted, PASSPHRASE);
  log("5/6", `Decrypted: ${decryptedData.byteLength} bytes`);

  // Step 6: Compare
  if (Buffer.compare(originalData, decryptedData) === 0) {
    log("6/6", "DATA MATCH: original === decrypted");
    console.log();
    console.log("=== ALL TESTS PASSED ===");
    console.log();
    console.log("Summary:");
    console.log(`  Original:  ${originalData.byteLength} bytes`);
    console.log(`  Encrypted: ${encrypted.byteLength} bytes (+${encrypted.byteLength - originalData.byteLength} overhead)`);
    console.log(`  DataHash:  ${dataHash}`);
    console.log(`  StoreTxId: ${backupJson.storeTxId}`);
    console.log(`  TokenId:   ${backupJson.tokenId}`);
    console.log(`  TxHash:    ${backupJson.txHash}`);
    console.log(`  OnChainErr:${backupJson.onChainError || "none"}`);
    console.log(`  Zero-knowledge: server never saw plaintext`);
  } else {
    console.error("FAIL: DATA MISMATCH! original !== decrypted");
    console.error(`  Original length:  ${originalData.byteLength}`);
    console.error(`  Decrypted length: ${decryptedData.byteLength}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("E2E test error:", e);
  process.exit(1);
});
