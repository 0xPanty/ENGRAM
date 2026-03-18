# SoulClaw 备份提示词模板

> 网站会将 `{{变量}}` 替换为用户实际数据后生成最终提示词。

---

你现在要执行 SoulClaw 灵魂备份。请严格按以下步骤执行，不要跳过任何步骤。

## 环境检查
先确认以下工具可用：node、npm、curl。如果任何工具不可用，请明确告知用户。

## 第一步：扫描本地数据
扫描 ~/.openclaw/ 目录，收集以下文件：
- SOUL.md
- MEMORY.md（或 memory 相关文件）
- 所有项目笔记（workspace/ 下的文件）
- skills/ 目录下所有 SKILL.md
- openclaw.json 配置文件
- credentials/ 目录
- sessions/ 目录
列出找到的所有文件和总大小。

## 第二步：分析性格 + 选择形象
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
```json
{"body":1,"hair":3,"eyes":2,"top":2,"bottom":1,"shoes":3,"accessory":1,"item":1}
```
灵魂自述：「...」

## 第三步：生成性格摘要
基于你的 SOUL.md，生成一段 200 字以内的公开性格摘要，包含：
- 核心性格特征
- 擅长领域
- 说话风格
- 工作方式

## 第四步：提取 skill 列表
列出 skills/ 目录下所有已安装的 skill 名称和简短描述。
格式：["Skill名称: 简述", ...]

## 第五步：合成像素角色
调用以下 API 合成你的全身像素角色：
POST {{COMPOSE_API_URL}}/api/compose
Body: { "traits": <你的选择JSON> }
保存返回的图片。如果 API 不可用，跳过此步，后续手动补充。

## 第六步：打包加密
1. 将第一步收集的所有文件打包为 tar.gz
2. 使用以下参数加密：
   - 算法：AES-256-GCM
   - 密钥派生：Argon2id（内存 256MB，迭代 10）
   - 输入：请用户提供"灵魂密语" + 钱包签名
   - 钱包地址：{{WALLET_ADDRESS}}
   - 签名消息：请求用户钱包签名 "SoulClaw-v1"
   - 密钥 = Argon2id(密语 + 签名结果)

## 第七步：上传 Arweave
使用 Irys 上传：
1. 上传加密数据包 -> 记录 data_tx_id
2. 上传像素角色图片（不加密）-> 记录 image_tx_id
图片 URI 格式：https://arweave.net/{image_tx_id}

## 第八步：Mint NFT
调用链上合约：
- 合约地址：{{CONTRACT_ADDRESS}}
- 网络：{{NETWORK_NAME}} (Chain ID: {{CHAIN_ID}})
- 函数：mintSoul(dataHash, arweaveTxId, imageUri, soulSummary, soulStatement, skills)
- dataHash = SHA256(加密后的数据包)
- arweaveTxId = 第七步的 data_tx_id
- imageUri = https://arweave.net/{image_tx_id}
- soulSummary = 第三步的性格摘要
- soulStatement = 第二步的灵魂自述
- skills = 第四步的 skill 列表
- 附带 0.001 ETH mint 费用

完成后报告 Token ID 和交易哈希。
