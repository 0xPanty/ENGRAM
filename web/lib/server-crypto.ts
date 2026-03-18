import { randomBytes, createCipheriv, createDecipheriv, createHash, scrypt as scryptCb } from "crypto";

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SCRYPT_N = 2 ** 17;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function deriveKey(passphrase: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(passphrase, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

export async function encrypt(
  plainData: Buffer,
  passphrase: string
): Promise<{ encrypted: Buffer; dataHash: string }> {
  const salt = randomBytes(32);
  const key = await deriveKey(passphrase, salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainData), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Format: [salt(32)] [iv(12)] [ciphertext] [tag(16)]
  const encryptedPackage = Buffer.concat([salt, iv, encrypted, tag]);
  const dataHash = "0x" + createHash("sha256").update(encryptedPackage).digest("hex");

  return { encrypted: encryptedPackage, dataHash };
}

export async function decrypt(
  encryptedPackage: Buffer,
  passphrase: string
): Promise<Buffer> {
  const salt = encryptedPackage.subarray(0, 32);
  const iv = encryptedPackage.subarray(32, 32 + IV_LENGTH);
  const tag = encryptedPackage.subarray(encryptedPackage.length - TAG_LENGTH);
  const ciphertext = encryptedPackage.subarray(32 + IV_LENGTH, encryptedPackage.length - TAG_LENGTH);

  const key = await deriveKey(passphrase, salt);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function computeDataHash(data: Buffer): string {
  return "0x" + createHash("sha256").update(data).digest("hex");
}
