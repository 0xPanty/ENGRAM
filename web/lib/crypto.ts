/**
 * SoulClaw 加密方案参考实现
 *
 * 密钥派生：Argon2id(passphrase + walletSignature) -> AES-256-GCM key
 * 加密：AES-256-GCM
 *
 * 此模块用于：
 * 1. 网站展示加密流程说明
 * 2. 提示词中引用的加密参数
 * 3. 未来 soulclaw-cli 的加密实现
 *
 * 注意：实际加密由 OpenClaw Agent 在本地执行，网站不接触明文数据。
 */

export const CRYPTO_CONFIG = {
  kdf: "argon2id",
  argon2: {
    memory: 262144, // 256 MB
    iterations: 10,
    parallelism: 1,
    hashLength: 32, // 256 bits for AES-256
  },
  cipher: "aes-256-gcm",
  signMessage: "SoulClaw-v1",
  ivLength: 12,
  tagLength: 16,
} as const;

/**
 * 加密数据包格式（字节布局）：
 *
 * [0..11]     IV (12 bytes)
 * [12..N-16]  Ciphertext
 * [N-16..N]   Auth Tag (16 bytes)
 *
 * 解密时：
 * 1. 从包头取 12 字节 IV
 * 2. 从包尾取 16 字节 Auth Tag
 * 3. 中间部分是密文
 * 4. 用 Argon2id(passphrase + signature) 派生密钥
 * 5. AES-256-GCM 解密
 */

/**
 * Node.js 环境下的加密实现（Agent / CLI 使用）
 *
 * 以下是 Agent 执行备份时应使用的伪代码：
 *
 * ```js
 * const argon2 = require('argon2');
 * const crypto = require('crypto');
 *
 * // 1. 获取密语和钱包签名
 * const passphrase = await askUser("请输入灵魂密语");
 * const signature = await wallet.signMessage("SoulClaw-v1");
 *
 * // 2. 派生密钥
 * const salt = Buffer.from(signature.slice(2), 'hex'); // 去掉 0x 前缀
 * const key = await argon2.hash(passphrase, {
 *   type: argon2.argon2id,
 *   salt: salt.slice(0, 32), // 取前 32 字节作 salt
 *   memoryCost: 262144,
 *   timeCost: 10,
 *   parallelism: 1,
 *   hashLength: 32,
 *   raw: true,
 * });
 *
 * // 3. AES-256-GCM 加密
 * const iv = crypto.randomBytes(12);
 * const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
 * const encrypted = Buffer.concat([cipher.update(plainData), cipher.final()]);
 * const tag = cipher.getAuthTag();
 * const encryptedPackage = Buffer.concat([iv, encrypted, tag]);
 *
 * // 4. 计算 dataHash
 * const dataHash = '0x' + crypto.createHash('sha256').update(encryptedPackage).digest('hex');
 * ```
 */

export function getCryptoInstructions(): string {
  return `加密参数：
- KDF: Argon2id
- 内存: ${CRYPTO_CONFIG.argon2.memory / 1024} MB
- 迭代: ${CRYPTO_CONFIG.argon2.iterations} 次
- 输出: ${CRYPTO_CONFIG.argon2.hashLength * 8} bit 密钥
- 加密: AES-256-GCM
- IV: ${CRYPTO_CONFIG.ivLength} 字节随机
- 签名消息: "${CRYPTO_CONFIG.signMessage}"
- 密钥输入: Argon2id(用户密语, salt=钱包签名前32字节)`;
}
