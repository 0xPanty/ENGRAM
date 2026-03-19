/**
 * .soulfilter -- 灵魂过滤器
 *
 * 决定哪些文件值得被刻印到链上。
 * 放在 ~/.openclaw/.soulfilter，格式类似 .gitignore。
 * 以 # 开头为注释，空行忽略，每行一个排除规则。
 */

export const DEFAULT_SOULFILTER = `# .soulfilter -- 灵魂过滤器
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
`;

export function parseSoulfilter(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

export function toTarExcludes(rules: string[]): string[] {
  return rules.map((rule) => `--exclude='${rule}'`);
}

export function toTarExcludeString(rules: string[]): string {
  return rules.map((rule) => `--exclude='${rule}'`).join(" ");
}
