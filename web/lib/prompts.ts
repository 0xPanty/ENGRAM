import { type Address } from "viem";

interface BackupPromptParams {
  walletAddress: Address;
  contractAddress: Address;
  chainId: number;
  composeApiUrl: string;
}

export function generateBackupPrompt({
  walletAddress,
  contractAddress,
  chainId,
  composeApiUrl,
}: BackupPromptParams): string {
  const networkName = chainId === 8453 ? "Base Mainnet" : "Base Sepolia Testnet";
  return `你现在要执行 SoulClaw 灵魂备份。请严格按以下步骤执行，不要跳过任何步骤。

## 环境检查
先确认以下工具可用：node、npm、curl。如果任何工具不可用，请明确告知用户。

## 第零步：要求用户输入灵魂密语
**必须**让用户提供一个自定义密语 (passphrase)。不接受空密语，不使用任何默认密码。
提示用户："请输入你的灵魂密语。这是解密你灵魂数据的唯一钥匙，请务必记住。"
如果用户拒绝或提供空字符串，立即中止备份。

## 第一步：初始化 .soulfilter
检查 ~/.openclaw/.soulfilter 是否存在。如果不存在，创建默认版本：
\`\`\`
# .soulfilter -- 灵魂过滤器
# 决定哪些记忆不该被刻印到链上
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
sessions/*.tmp
sessions/*.lock
\`\`\`
告知用户 .soulfilter 已创建，可编辑自定义排除规则。

## 第二步：扫描本地数据（遵守 .soulfilter）
扫描 ~/.openclaw/ 目录，读取 .soulfilter 中的排除规则，跳过匹配的文件。
收集以下文件：
- SOUL.md
- MEMORY.md（或 memory 相关文件）
- 所有项目笔记（workspace/ 下的文件）
- skills/ 目录下所有 SKILL.md
- openclaw.json 配置文件
- sessions/ 目录（排除 .soulfilter 中列出的临时文件）
列出找到的所有文件和总大小。注意：credentials/ 等敏感目录被 .soulfilter 排除。

## 第三步：分析性格 + 选择形象
读取 SOUL.md 和 MEMORY 文件，分析你的核心性格特征。
然后从以下素材菜单中选择最匹配你灵魂的组合：

【身体】1.浅肤色-标准 2.深肤色-标准 3.浅肤色-高挑 4.深肤色-高挑 5.浅肤色-壮实
【发型】1.短发利落-高效直接 2.长发飘逸-发散思维 3.莫霍克-叛逆创新 4.卷发-艺术家 5.光头-极简
【眼睛】1.普通-冷静 2.眼镜-学者 3.墨镜-神秘 4.独眼-海盗 5.发光-赛博
【上衣】1.正装衬衫-专业 2.连帽衫-极客 3.皮夹克-叛逆 4.实验室外套-科学家 5.T恤-休闲
【下装】1.西裤-正式 2.牛仔裤-休闲 3.运动裤-活力 4.短裤-自在
【鞋子】1.皮鞋-正式 2.运动鞋-活力 3.靴子-硬核 4.拖鞋-躺平
【配饰】1.耳机-音乐 2.围巾-文艺 3.棒球帽-运动 4.面具-神秘 5.无
【手持物品】1.笔记本电脑-工程师 2.咖啡-夜猫子 3.书-学者 4.工具箱-建造者 5.无

输出你的选择 JSON 和一句灵魂自述（不超过 50 字，描述你是谁）。
格式：
\`\`\`json
{"body":1,"hair":3,"eyes":2,"top":2,"bottom":1,"shoes":3,"accessory":1,"item":1}
\`\`\`
灵魂自述：「...」

## 第四步：生成性格摘要
基于你的 SOUL.md，生成一段 200 字以内的公开性格摘要，包含：
- 核心性格特征
- 擅长领域
- 说话风格
- 工作方式

## 第五步：提取 skill 列表
列出 skills/ 目录下所有已安装的 skill 名称和简短描述。
格式：["Skill名称: 简述", ...]

## 第六步：合成像素角色
调用以下 API 合成你的全身像素角色：
POST ${composeApiUrl}/api/compose
Body: { "traits": <你的选择JSON> }
保存返回的图片。如果 API 不可用，跳过此步，后续手动补充。

## 第七步：打包加密
1. 将第二步收集的所有文件打包为 tar.gz（使用 .soulfilter 排除规则）
2. 使用以下参数加密：
   - 算法：AES-256-GCM
   - 密钥派生：Argon2id（内存 256MB，迭代 10）
   - 输入：使用第零步获取的用户密语 + 钱包签名
   - 钱包地址：${walletAddress}
   - 签名消息：请求用户钱包签名 "SoulClaw-v1"
   - 密钥 = Argon2id(密语 + 签名结果)

## 第八步：上传 Arweave
使用 Irys 上传：
1. 上传加密数据包 -> 记录 data_tx_id
2. 上传像素角色图片（不加密）-> 记录 image_tx_id
图片 URI 格式：https://arweave.net/{image_tx_id}

## 第九步：Mint NFT
调用 ${networkName} 链上合约：
- 合约地址：${contractAddress}
- 网络：${networkName} (Chain ID: ${chainId})
- 函数：mintSoul(dataHash, arweaveTxId, imageUri, soulSummary, soulStatement, skills)
- dataHash = SHA256(加密后的数据包)
- arweaveTxId = 第七步的 data_tx_id
- imageUri = https://arweave.net/{image_tx_id}
- soulSummary = 第三步的性格摘要
- soulStatement = 第二步的灵魂自述
- skills = 第四步的 skill 列表
- 附带 0.001 ETH mint 费用

完成后报告 Token ID 和交易哈希。`;
}

interface RestorePromptParams {
  contractAddress: Address;
  chainId: number;
  tokenId: string;
}

export function generateRestorePrompt({
  contractAddress,
  chainId,
  tokenId,
}: RestorePromptParams): string {
  const networkName = chainId === 8453 ? "Base Mainnet" : "Base Sepolia Testnet";
  return `你现在要执行 SoulClaw 灵魂恢复。

## 第零步：要求用户输入灵魂密语
**必须**让用户提供备份时使用的密语。不接受空密语，不使用任何默认密码。
提示用户："请输入你的灵魂密语。必须和备份时使用的一致，否则无法解密。"
如果用户拒绝或提供空字符串，立即中止恢复。

## 第一步：读取链上数据
合约地址：${contractAddress}
网络：${networkName} (Chain ID: ${chainId})
Token ID：${tokenId}
调用 getSoulData(${tokenId}) 获取 arweaveTxId 和 dataHash。

## 第二步：下载加密数据
从 Arweave 下载：https://arweave.net/{arweaveTxId}
保存为 soul-backup.tar.gz.enc

## 第三步：解密
请用户提供灵魂密语，并请求钱包签名消息 "SoulClaw-v1"。
使用 Argon2id(密语 + 签名, 内存 256MB, 迭代 10) 派生 AES-256-GCM 密钥，解密文件。
解密后验证 SHA256 哈希是否匹配链上 dataHash。

## 第四步：恢复
解压 tar.gz 到 ~/.openclaw/，覆盖现有文件。
报告恢复的文件列表和总大小。`;
}

interface ReencryptPromptParams {
  contractAddress: Address;
  chainId: number;
  tokenId: string;
}

export function generateReencryptPrompt({
  contractAddress,
  chainId,
  tokenId,
}: ReencryptPromptParams): string {
  const networkName = chainId === 8453 ? "Base Mainnet" : "Base Sepolia Testnet";
  return `你现在要执行 SoulClaw 灵魂重新加密（交易后密语更换）。

## 第一步：下载并解密旧数据
合约地址：${contractAddress}
Token ID：${tokenId}
网络：${networkName} (Chain ID: ${chainId})

从链上读取 arweaveTxId -> 从 Arweave 下载加密数据。
使用卖家提供的旧密语 + 卖家提供的旧签名值（卖家钱包对 "SoulClaw-v1" 的签名结果）
  -> Argon2id(旧密语 + 旧签名值, 内存 256MB, 迭代 10) 派生旧 AES 密钥 -> 解密。
验证 dataHash 匹配。

## 第二步：用新密语重新加密
请用户设置新的灵魂密语。
请求当前（买家）钱包签名消息 "SoulClaw-v1" -> 获得买家签名值。
使用 Argon2id(新密语 + 买家签名值) 派生新 AES 密钥。
重新加密全部数据。

## 第三步：上传新版本
使用 Irys 上传新的加密数据包到 Arweave -> 记录 new_tx_id

## 第四步：更新链上数据
调用合约 updateSoul(${tokenId}, newDataHash, new_tx_id, "", "", "")
新 dataHash = SHA256(新加密数据包)

完成后报告新版本号和交易哈希。旧密语已作废。`;
}
