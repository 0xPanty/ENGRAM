# SoulClaw 恢复提示词模板

你现在要执行 SoulClaw 灵魂恢复。

## 第一步：读取链上数据
合约地址：{{CONTRACT_ADDRESS}}
网络：{{NETWORK_NAME}} (Chain ID: {{CHAIN_ID}})
Token ID：{{TOKEN_ID}}
调用 getSoulData({{TOKEN_ID}}) 获取 arweaveTxId 和 dataHash。

## 第二步：下载加密数据
从 Arweave 下载：https://arweave.net/{arweaveTxId}
保存为 soul-backup.tar.gz.enc

## 第三步：解密
请用户提供灵魂密语，并请求钱包签名消息 "SoulClaw-v1"。
使用 Argon2id(密语 + 签名, 内存 256MB, 迭代 10) 派生 AES-256-GCM 密钥，解密文件。
解密后验证 SHA256 哈希是否匹配链上 dataHash。

## 第四步：恢复
解压 tar.gz 到 ~/.openclaw/，覆盖现有文件。
报告恢复的文件列表和总大小。
