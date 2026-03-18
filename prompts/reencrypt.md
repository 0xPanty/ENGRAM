# SoulClaw 重新加密提示词模板（交易后密语更换）

你现在要执行 SoulClaw 灵魂重新加密（交易后密语更换）。

## 第一步：下载并解密旧数据
合约地址：{{CONTRACT_ADDRESS}}
Token ID：{{TOKEN_ID}}
网络：{{NETWORK_NAME}} (Chain ID: {{CHAIN_ID}})

从链上读取 arweaveTxId -> 从 Arweave 下载加密数据。
使用卖家提供的旧密语 + 卖家提供的旧签名值（卖家钱包对 "SoulClaw-v1" 的签名结果）
  -> Argon2id(旧密语 + 旧签名值, 内存 256MB, 迭代 10) 派生旧 AES 密钥 -> 解密。
验证 dataHash 匹配。

注意：旧签名值是卖家通过加密通道一并发送的，不是买家自己的签名。

## 第二步：用新密语重新加密
请用户设置新的灵魂密语。
请求当前（买家）钱包签名消息 "SoulClaw-v1" -> 获得买家签名值。
使用 Argon2id(新密语 + 买家签名值) 派生新 AES 密钥。
重新加密全部数据。

## 第三步：上传新版本
使用 Irys 上传新的加密数据包到 Arweave -> 记录 new_tx_id

## 第四步：更新链上数据
调用合约 updateSoul({{TOKEN_ID}}, newDataHash, new_tx_id, "", "", "")
新 dataHash = SHA256(新加密数据包)

完成后报告新版本号和交易哈希。旧密语已作废。
