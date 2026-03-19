---
name: soulclaw
description: "Back up and restore your OpenClaw soul on-chain. Encrypts your SOUL.md, memory, skills, and project notes, uploads to Arweave for permanent storage, and mints a Soul NFT on Base. Use when: user wants to backup their soul, restore from chain, or update their on-chain soul. NOT for: general file backup, non-OpenClaw data."
homepage: https://soulclaw.xyz
metadata:
  {
    "openclaw":
      {
        "emoji": "🔮",
        "requires": { "bins": ["curl", "node"] },
      },
  }
---

# SoulClaw Skill

Back up your OpenClaw soul permanently on-chain. One command to save, one command to restore.

## Setup (First Time Only)

Set your API key as environment variable:

```bash
export SOULCLAW_API_KEY="YOUR_API_KEY"
```

Get your API key at https://soulclaw.xyz after connecting your wallet.

## When to Use

✅ **USE this skill when:**

- "帮我备份灵魂" / "Back up my soul"
- "备份到链上" / "Save my soul on-chain"
- "恢复灵魂" / "Restore my soul"
- "更新链上记忆" / "Update my on-chain soul"
- "查看灵魂状态" / "Check my soul status"

## When NOT to Use

❌ **DON'T use this skill when:**

- General file backup (use regular backup tools)
- Non-OpenClaw data
- Backing up API keys only (use a password manager)

## Commands

### Backup (Push Soul On-Chain)

Scan all OpenClaw data, encrypt locally, upload encrypted blob to API, mint/update NFT on Base.

**Important: All encryption happens locally on your machine. The server never sees your plaintext data.**

```bash
# Step 0: Ask user for passphrase (REQUIRED, do NOT skip)
# Prompt: "请输入你的灵魂密语 (passphrase)。这是解密你灵魂数据的唯一钥匙，请务必记住。"
# If user provides empty string or refuses, ABORT backup immediately.
# NEVER use a default/hardcoded passphrase.
read -s -p "Enter your soul passphrase: " PASSPHRASE
echo
if [ -z "$PASSPHRASE" ]; then
  echo "ERROR: Passphrase is required. Aborting backup."
  exit 1
fi

# Step 1: Initialize .soulfilter (if not exists)
SOUL_DIR="$HOME/.openclaw"
SOULFILTER="$SOUL_DIR/.soulfilter"
if [ ! -f "$SOULFILTER" ]; then
  echo "Creating default .soulfilter..."
  cat > "$SOULFILTER" << 'FILTER'
# .soulfilter -- 灵魂过滤器
# 决定哪些记忆不该被刻印到链上
# 格式同 .gitignore: 每行一条排除规则, # 开头为注释

# === 安全: 绝对不能上链的 ===
credentials/
*.key
*.pem
*.p12
*.pfx
*.env
*.env.*
.env.local
.env.production
**/secrets/
**/private/

# === 大文件 / 缓存: 没必要上链 ===
node_modules/
.npm/
.cache/
__pycache__/
*.pyc
.DS_Store
Thumbs.db
*.log
*.tmp
*.swp
*~

# === 会话临时数据 ===
sessions/*.tmp
sessions/*.lock
FILTER
  echo "Default .soulfilter created at $SOULFILTER"
  echo "You can edit it to customize which files are excluded from backup."
fi

# Step 2: Collect all OpenClaw data (respecting .soulfilter)
BACKUP_FILE="/tmp/soulclaw-backup-$(date +%s).tar.gz"

echo "=== Scanning OpenClaw data ==="
echo "Applying exclusion rules from .soulfilter..."

# Parse .soulfilter into tar --exclude flags
EXCLUDES=""
while IFS= read -r line; do
  line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  [ -z "$line" ] && continue
  [[ "$line" == \#* ]] && continue
  EXCLUDES="$EXCLUDES --exclude='$line'"
done < "$SOULFILTER"

du -sh "$SOUL_DIR" 2>/dev/null

# Step 3: Package (with .soulfilter exclusions)
eval tar -czf "$BACKUP_FILE" -C "$HOME" $EXCLUDES .openclaw/
echo "Packaged: $(du -sh $BACKUP_FILE | cut -f1)"

# Step 4: Encrypt locally
# Derive key: scrypt(passphrase, salt=random32bytes) -> AES-256-GCM key
# Encrypt: [salt(32)][iv(12)][ciphertext][tag(16)]
# Compute dataHash: SHA-256 of encrypted blob
ENCRYPTED_FILE="/tmp/soulclaw-encrypted-$(date +%s).bin"
DATA_HASH=$(node -e "
const crypto = require('crypto');
const fs = require('fs');
const passphrase = process.argv[1];
const plain = fs.readFileSync(process.argv[2]);
const salt = crypto.randomBytes(32);
const key = crypto.scryptSync(passphrase, salt, 32, {N:16384,r:8,p:1});
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
const tag = cipher.getAuthTag();
const pkg = Buffer.concat([salt, iv, enc, tag]);
fs.writeFileSync('$ENCRYPTED_FILE', pkg);
const hash = '0x' + crypto.createHash('sha256').update(pkg).digest('hex');
console.log(hash);
" "$PASSPHRASE" "$BACKUP_FILE")
echo "dataHash: $DATA_HASH"

# Step 5: Upload encrypted blob to SoulClaw API (server never sees plaintext)
curl -X POST "https://engram-five.vercel.app/api/backup" \
  -H "Authorization: Bearer $SOULCLAW_API_KEY" \
  -F "backup=@$ENCRYPTED_FILE" \
  -F "dataHash=$DATA_HASH"

# Clean up temp files (passphrase only lives in memory)
rm -f "$BACKUP_FILE" "$ENCRYPTED_FILE"
unset PASSPHRASE
```

### Restore (Pull Soul From Chain)

```bash
# Step 0: Ask user for passphrase (REQUIRED, must match the one used during backup)
# Prompt: "请输入你的灵魂密语。必须和备份时使用的一致，否则无法解密。"
# If user provides empty string or refuses, ABORT restore immediately.
read -s -p "Enter your soul passphrase: " PASSPHRASE
echo
if [ -z "$PASSPHRASE" ]; then
  echo "ERROR: Passphrase is required. Aborting restore."
  exit 1
fi

# Step 1: Download encrypted blob from server
ENCRYPTED_FILE="/tmp/soulclaw-encrypted-restore.bin"
curl -X POST "https://engram-five.vercel.app/api/restore" \
  -H "Authorization: Bearer $SOULCLAW_API_KEY" \
  -o "$ENCRYPTED_FILE"

# Step 2: Decrypt locally with user's passphrase
RESTORE_FILE="/tmp/soulclaw-restore.tar.gz"
node -e "
const crypto = require('crypto');
const fs = require('fs');
const passphrase = process.argv[1];
const pkg = fs.readFileSync(process.argv[2]);
const salt = pkg.subarray(0, 32);
const iv = pkg.subarray(32, 44);
const tag = pkg.subarray(pkg.length - 16);
const enc = pkg.subarray(44, pkg.length - 16);
const key = crypto.scryptSync(passphrase, salt, 32, {N:16384,r:8,p:1});
const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
decipher.setAuthTag(tag);
const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
fs.writeFileSync('$RESTORE_FILE', dec);
console.log('Decrypted OK');
" "$PASSPHRASE" "$ENCRYPTED_FILE"

# Step 3: Extract to OpenClaw directory
tar -xzf "$RESTORE_FILE" -C "$HOME/"

# Clean up temp files
rm -f "$ENCRYPTED_FILE" "$RESTORE_FILE"
unset PASSPHRASE

echo "Soul restored successfully."
```

### Check Status

```bash
curl -s "https://engram-five.vercel.app/api/status" \
  -H "Authorization: Bearer $SOULCLAW_API_KEY" | node -e "
    const d = require('fs').readFileSync(0,'utf8');
    const j = JSON.parse(d);
    console.log('Token ID:', j.tokenId);
    console.log('Version:', j.version);
    console.log('Last Updated:', new Date(j.lastUpdated * 1000).toLocaleString());
    console.log('Skills:', (j.skills || []).join(', '));
  "
```

## Notes

- First backup mints a new Soul NFT (costs ~0.001 ETH on Base)
- Subsequent backups update the existing NFT (cheaper)
- **Zero-knowledge**: encryption/decryption happens entirely on your machine. The server only stores and retrieves ciphertext.
- **Passphrase is REQUIRED**: you must provide a passphrase for every backup and restore. There is no default. Lose it and your data is unrecoverable. The server cannot help.
- **`.soulfilter`**: on first backup, a default exclusion file is created at `~/.openclaw/.soulfilter`. Edit it to control which files are excluded.
- Private keys, .key, .pem, .env files are excluded from backup by default via .soulfilter
- API key authenticates you; passphrase protects your data -- they serve different purposes
