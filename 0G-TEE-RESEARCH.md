# 0G TEE Oracle & ERC-7857 研究报告

> **最后更新**: 2026-03-25
> **研究目的**: SoulClaw 项目升级 ERC-7857，接入 0G TEE Oracle 实现安全 iTransfer
> **状态**: Dev (Dragon) 已回复，提供了 Oracle 内部文档 + 可能开放测试节点
> **重要更新**: ERC-7857 iNFT 即将更名为 **Agentic ID**（下周官宣）

---

## 一、0G 基础设施全景

### 1.1 0G 是什么
- 去中心化 AI 基础设施协议，$300M+ 融资
- 提供：0G Chain（EVM L1）、0G Storage（去中心化存储）、0G Compute（TEE 计算）、0G DA（数据可用性）
- 主网：Aristotle Mainnet（2025年9月上线）
- 测试网：Galileo Testnet
- Chain ID (Mainnet): 16600
- RPC: `https://evmrpc.0g.ai`
- 浏览器: https://chainscan.0g.ai/ (mainnet), https://chainscan-galileo.0g.ai/ (testnet)

### 1.2 0G 与 SoulClaw 的关系
- **0G Storage**: 我们已接入，存加密灵魂数据（@0gfoundation/0g-ts-sdk v1.2.x）
- **0G Chain**: ERC-7857 原生链，AIverse 市场在此运行
- **0G TEE Oracle**: iTransfer 时做 re-encryption + 签 proof，我们想接入但 API 未公开
- **当前状态**: 合约部署在 Base Sepolia，存储用 0G Storage，TEE 用自建 oracle 模拟

---

## 二、ERC-7857 标准详解

### 2.1 核心概念
ERC-7857 扩展 ERC-721，支持加密元数据的安全转移。核心思路：
- NFT 不只转移 tokenId 所有权，还要转移加密的 metadata
- 转移时 metadata 需要用新密钥重新加密（re-encryption）
- 由 TEE 或 ZKP Oracle 执行 re-encryption 并签名证明

### 2.2 iTransfer 完整流程
```
1. Sender 把 oldDataHash + 加密数据 + 加密密钥(用TEE公钥加密) 发给 TEE
2. TEE 在安全环境中：
   - 用自己的私钥解密得到 old key
   - 用 old key 解密得到原始 metadata
   - 生成新 key，用新 key 重新加密 metadata → newDataHash
   - 用 receiver 的公钥加密新 key → sealedKey
   - 签名 proof（证明 oldDataHash → newDataHash 是正确的重加密）
3. Sender 找 Receiver 签一个 access proof（证明 receiver 能访问 newDataHash）
4. Sender 调合约 iTransferFrom(from, to, tokenId, [proof])
5. 合约验证两个签名 → 转移 NFT + 更新 dataHash + 发布 sealedKey
6. Receiver 用自己的私钥解密 sealedKey 得到新 key → 解密 metadata
```

### 2.3 两种 Oracle 实现
| | TEE | ZKP |
|---|---|---|
| 安全性 | 硬件级隔离 | 数学证明 |
| 密钥生成 | TEE 可安全生成新密钥 | 不能，sender 必须参与 |
| 性能 | 快 | 慢（proof generation 耗时） |
| 0G 实现状态 | 已在主网运行 | TODO（代码里写了但没实现） |

### 2.4 ERC-7857 官方文档
- ERC-7857 技术规范: https://docs.0g.ai/developer-hub/building-on-0g/inft/erc7857
- INFT 概览: https://docs.0g.ai/developer-hub/building-on-0g/inft/inft-overview
- 集成指南: https://docs.0g.ai/developer-hub/building-on-0g/inft/integration
- EIP 提案: https://github.com/ethereum/EIPs/pull/7857

---

## 三、0G 官方合约仓库分析

### 3.1 仓库地址
https://github.com/0gfoundation/0g-agent-nft

### 3.2 分支对比

| 分支 | 最后更新 | 状态 | 说明 |
|---|---|---|---|
| `main` | Feb 2, 2026 | 默认/稳定 | 完整的 ERC-7857 + TEEVerifier + AgentMarket + 费用分配 |
| `better-7857` | Jan 15, 2026 | 已合并(PR#10) | 重构为模块化合约，加 ERC721 兼容 |
| `fix-sealed-key-miss` | **Mar 3, 2026** | **最新开发分支(PR#11 Open)** | 修复 sealedKey 事件 + 外部NFT白名单 + batch mint |
| `eip-7857-draft` | 旧 | 早期草案 | 文档引用的旧实现，不要用 |

**应该看 `fix-sealed-key-miss` 分支**（mod 推荐，最新代码）

### 3.3 合约架构（main 分支）

```
contracts/
├── AgentNFT.sol                    # 主 NFT 合约 (ERC-7857 + ERC-721 兼容)
├── ERC7857Upgradeable.sol          # ERC-7857 基础实现 (Upgradeable)
├── AgentMarket.sol                 # 交易市场合约
├── TeeVerifier.sol                 # TEE 签名验证器 (底层)
├── Utils.sol                       # 工具函数
├── verifiers/
│   ├── Verifier.sol                # 上层验证器 (包装 TEEVerifier)
│   └── base/
│       └── BaseVerifier.sol        # 验证器基类
├── extensions/
│   ├── ERC7857CloneableUpgradeable.sol    # iClone 功能
│   └── ERC7857IDataStorageUpgradeable.sol # iData 存储
└── interfaces/
    ├── IERC7857.sol                # ERC-7857 接口
    ├── IERC7857Cloneable.sol       # Clone 接口
    ├── IERC7857DataVerifier.sol    # Verifier 接口
    ├── IERC7857Metadata.sol        # Metadata 接口
    └── IAgentMarket.sol            # 市场接口
```

### 3.4 关键合约代码分析

#### TeeVerifier.sol（底层 TEE 签名验证）
```solidity
// 位置: contracts/TeeVerifier.sol
// 功能: 纯 ECDSA 签名验证，对比 teeOracleAddress
// 版本: 1.0.0
// 模式: Upgradeable (Beacon Proxy) + AccessControl + Pausable

function verifyTEESignature(bytes32 dataHash, bytes calldata signature) external view returns (bool) {
    require(signature.length == 65, "Invalid signature length");
    address signer = dataHash.recover(signature);
    return signer == $.teeOracleAddress;
}

// 初始化时设置 oracle 地址
function initialize(address _admin, address _teeOracleAddress) public initializer { ... }
// 可更新 oracle 地址
function updateOracleAddress(address newOracleAddress) public onlyRole(ADMIN_ROLE) { ... }
```

#### Verifier.sol（上层验证器，实现 IERC7857DataVerifier）
```solidity
// 位置: contracts/verifiers/Verifier.sol
// 功能: 解析 proof 结构体，调用 TeeVerifier 验证签名
// 版本: 1.0.0 (但主网部署的 VERSION() 返回 "2.0.0"，说明已 upgrade)

// 验证 Ownership Proof 的签名格式（重要！）
function verifyOwnershipProof(OwnershipProof memory ownershipProof) private view returns (bool) {
    // 注意：使用自定义的签名格式，不是标准 EIP-191
    bytes32 messageHash = keccak256(
        abi.encodePacked(
            "\x19Ethereum Signed Message:\n66",  // 固定 66 字节
            Strings.toHexString(
                uint256(keccak256(abi.encodePacked(
                    ownershipProof.dataHash,
                    ownershipProof.sealedKey,
                    ownershipProof.targetPubkey,
                    ownershipProof.nonce
                ))),
                32
            )
        )
    );
    return teeOracleVerify(messageHash, ownershipProof.proof);
}

// 验证 Access Proof（receiver 签名）
function verifyAccessibility(AccessProof memory accessProof) private pure returns (address) {
    bytes32 messageHash = keccak256(
        abi.encodePacked(
            "\x19Ethereum Signed Message:\n66",
            Strings.toHexString(
                uint256(keccak256(abi.encodePacked(
                    accessProof.dataHash,
                    accessProof.targetPubkey,
                    accessProof.nonce
                ))),
                32
            )
        )
    );
    return messageHash.recover(accessProof.proof);
}

// 配置: 通过 AttestationConfig 映射不同 OracleType 到不同验证合约
struct AttestationConfig {
    OracleType oracleType;   // TEE = 0
    address contractAddress;  // TEEVerifier 合约地址
}
```

#### Proof 数据结构（来自 IERC7857DataVerifier.sol）
```solidity
// 注意：fix-sealed-key-miss 分支的结构可能有变化
struct AccessProof {
    bytes32 dataHash;      // 当前数据 hash
    bytes targetPubkey;    // receiver 的公钥
    bytes nonce;           // 防重放
    bytes proof;           // receiver 的 ECDSA 签名
}

struct OwnershipProof {
    OracleType oracleType; // TEE = 0
    bytes32 dataHash;      // 当前数据 hash
    bytes sealedKey;       // 用 receiver 公钥加密的新密钥
    bytes targetPubkey;    // receiver 的公钥
    bytes nonce;           // 防重放
    bytes proof;           // TEE Oracle 的 ECDSA 签名
}

struct TransferValidityProof {
    AccessProof accessProof;
    OwnershipProof ownershipProof;
}
```

### 3.5 fix-sealed-key-miss 分支关键改动（PR#11, Mar 3, 2026）

1. **修复 sealedKey 事件**
   - `PublishedSealedKey` 事件从 Clone 移到 `_updateData()`
   - mint/update/clone 都会正确发出 sealedKey 事件

2. **外部 NFT 合约白名单**
   - `AgentMarket.addSupportedNFT(address)` — 注册第三方 ERC-7857 合约
   - `AgentMarket.removeSupportedNFT(address)` — 移除
   - `AgentMarket.isSupportedNFT(address)` — 查询
   - 交易时会检查外部合约是否支持 `IERC7857` 接口（ERC165）

3. **mint/update 函数签名变化**（加了 sealedKeys 参数）
   ```solidity
   function mint(IntelligentData[] calldata iDatas, address to, bytes[] memory sealedKeys) ...
   function update(uint256 tokenId, IntelligentData[] calldata newDatas, bytes[] memory sealedKeys) ...
   ```

4. **batch mint**
   - `batchPaidMint()` 最多 100 个 (MAX_BATCH_MINT_SIZE)

### 3.6 部署脚本分析

`scripts/deploy/deploy_tee.ts`:
```typescript
// 默认 TEE Oracle 地址（可能是测试用的占位符）
const oracleAddress = process.env.ORACLE_ADDRESS || "0x04581d192d22510ced643eaced12ef169644811a";
// 注意：这个地址在 0G mainnet chainscan 上搜不到
```

`scripts/deploy/deploy_verifier.ts`:
```typescript
// Verifier 依赖 TEEVerifier
// AttestationConfig: { oracleType: 0 (TEE), contractAddress: TEEVerifier地址 }
```

---

## 四、0G Mainnet 已部署合约（链上验证）

### 4.1 合约地址（通过 RPC 直接查询验证）

| 合约 | 地址 | 类型 |
|---|---|---|
| **Verifier (Proxy)** | `0x0D844d0E48027Ad5Fa14982c6c6Efadf39814E1E` | Beacon Proxy |
| Verifier Beacon | `0xee2e3bc3aeba993aa1685ad7bdfd3bee635149f1` | Beacon |
| **Verifier Implementation** | `0x0c26e7b57fdfba5080592ddc8e37b95f3cb49518` | 已验证源码 (mod确认) |
| **TEEVerifier (Proxy)** | `0x1D09b18Cba1a4841D42f51183c84DDb083537BD0` | Beacon Proxy |
| TEEVerifier Beacon | `0xd9d94ff38e386caa472596825e8e948cd94f2757` | Beacon |
| Verifier Admin | `0x7a0CCeb3B172ec11eaff88715eF7246a1abbb4D2` | EOA |

### 4.2 链上读取结果

```
Verifier.admin() = 0x7a0CCeb3B172ec11eaff88715eF7246a1abbb4D2
Verifier.VERSION() = "2.0.0"  (源码写 1.0.0，说明已 upgrade)
Verifier.maxProofAge() = 604800 (7天，单位秒)
Verifier.paused() = false
Verifier.attestationContract(0) = 0x1D09b18Cba1a4841D42f51183c84DDb083537BD0 (OracleType.TEE=0)

TEEVerifier.teeOracleAddress() = REVERT (可能未初始化或版本不同)
TEEVerifier.admin() = REVERT
TEEVerifier.VERSION() = REVERT
// TEEVerifier 所有 view 函数都 revert，原因待确认
```

### 4.3 iNFT 合约（mod 提供的信息）
- 官方 iNFT 合约（AgentNFT）指向的 TEE 合约就是 `0x0D844d0E48027Ad5Fa14982c6c6Efadf39814E1E`
- 这是 Verifier（上层），不是 TEEVerifier（底层）
- mod 原话："指向的实现合约也是验证过的，能看到代码"

---

## 五、0G Tapp（TEE 基础设施平台）

### 5.1 概述
- 仓库: https://github.com/0gfoundation/0g-tapp
- 语言: Rust
- 功能: 在 TEE 硬件（TDX/SEV/SGX）中安全运行 Docker 容器
- 通信: gRPC (端口 50051)
- 安全模型: "Malicious Deployer Protection" — 即使部署者也无法访问应用数据

### 5.2 Tapp 与 TEE Oracle 的关系
```
0G Tapp (基础设施)
  └─ 提供安全执行环境 (TEE 硬件 + Docker)
       └─ 里面跑着 "TEE Oracle 服务" (做 re-encryption)
            └─ 这个服务的代码和 API 没有开源
            └─ 只有 AIverse 内部在用
```

### 5.3 Tapp gRPC API（tapp_service.proto）
只是容器管理 API，**没有 re-encryption 相关接口**：
- `StartApp` / `StopApp` — 启停 Docker 应用
- `GetEvidence` — 获取 attestation 证据
- `GetAppKey` / `GetAppSecretKey` — 获取应用绑定的密钥
- `GetTaskStatus` — 查看任务状态
- 权限管理、日志查看等运维功能

### 5.4 Tapp 关键配置
```toml
[server]
host = "0.0.0.0"
port = 50051

[server.permission]
enabled = true
owner_address = "0xea695C312CE119dE347425B29AFf85371c9d1837"
```

### 5.5 Tapp 部署环境
- 阿里云 ECS 机密计算实例
- 实例类型: `ecs.gn8v-tee.4xlarge`
- 区域: 中国(北京) - 可用区L
- 镜像: 自定义机密镜像 (qcow2)
- dm-verity 校验系统完整性

---

## 六、AIverse 平台

### 6.1 概述
- URL: https://aiverse.0g.ai/
- 定位: "OpenSea for AI agents" — AI Agent 的 iNFT 市场
- 链: 0G Aristotle Mainnet
- 上线: 2026年3月4日（公告）
- 功能: 创建、交易、拥有 AI Agent（作为 iNFT）

### 6.2 与我们的关系
- AIverse 使用的 AgentNFT 合约实现了 ERC-7857
- `fix-sealed-key-miss` 分支的 `addSupportedNFT()` 允许白名单外部 ERC-7857 合约
- 理论上：如果我们把 SoulClawV3 部署到 0G Chain，可以申请接入 AIverse 市场
- 前提：需要用 0G 的 Verifier/TEEVerifier 或自部署兼容的验证器

---

## 七、我们的 SoulClawV3 实现

### 7.1 已完成
- **SoulClawV3.sol**: ERC-721 + ERC-2981 + ERC-7857，保留所有 SoulClaw 特有功能
- **MockVerifier.sol**: 测试用，放行所有 proof
- **SoulClawVerifier.sol**: ECDSA 签名验证，可配置 oracle 地址
- **42/42 单元测试通过** (26 legacy + 16 new)
- **Base Sepolia 部署成功**
- **iTransfer E2E 测试通过**（双签名验证：receiver access + oracle ownership）

### 7.2 Base Sepolia 合约地址

| 合约 | 地址 |
|---|---|
| SoulClawV3 | `0x57f3a2b9023d3883b3d51d90da3865bf5a873859` |
| SoulClawVerifier | `0x0B0e2C1295985beF30c502B7D9A70910d8A98FE1` |
| MockVerifier | `0x4f5a9ca355b8cbb9e511c3bfc4c0d06c26d58ff7` |

### 7.3 与 0G 官方实现的差异

| 对比项 | 0G 官方 (AgentNFT) | 我们 (SoulClawV3) |
|---|---|---|
| 升级性 | Upgradeable (Beacon Proxy) | 非 Upgradeable |
| Verifier | 两层：Verifier → TEEVerifier | 单层：SoulClawVerifier |
| 签名格式 | `"\x19Ethereum Signed Message:\n66"` + hex encode | 标准 `toEthSignedMessageHash` |
| Proof 结构 | AccessProof + OwnershipProof 嵌套 | 扁平结构（单个 TransferValidityProof） |
| 市场 | AgentMarket（内置交易+费用分配） | 无（需另建） |
| Clone | 支持 iClone | 支持 iClone |
| 额外功能 | creatorOf, paidMint, batchMint | mintSoul, mintSoulFor, skills, soulSummary |

### 7.4 兼容性问题
**如果要接入 0G 的 TEE Oracle，签名格式需要对齐：**
- 0G 用 `Strings.toHexString(uint256(keccak256(...)), 32)` 然后包在 `"\x19Ethereum Signed Message:\n66"` 里
- 我们用标准的 `keccak256(...).toEthSignedMessageHash()`
- 这意味着同一个 TEE 签的 proof，在我们的 Verifier 里会验证失败
- **解决方案**: 写一个兼容 0G 签名格式的 Verifier，或改我们的合约

---

## 八、待确认问题（已发 DC，等 Dev 回复）

### Q1: TEE Oracle re-encryption API
re-encryption 服务的 HTTP/gRPC API 有文档或 SDK 吗？还是只有 AIverse 内部用？

### Q2: 跨链支持
0G TEE Oracle 能给 Base 链上的合约签 proof 吗？

### Q3: 0G Chain 部署细节
- 用 Aristotle Mainnet 还是 Galileo Testnet？
- TEEVerifier `0x1D09b18C...` 的 view 函数全 revert 是为什么？
- 能不能直接用官方已部署的 Verifier？

### Q4: AIverse 接入
如何申请 addSupportedNFT 白名单？

### Q5: B站第四集教程
有没有演示 iTransfer 调用 TEE 的完整流程？

---

## 九、推荐的下一步行动

### 方案 A: 继续 Base + 自建 Oracle（当前方案）
- **优点**: 已跑通，不依赖 0G 团队
- **缺点**: oracle 是我们自己的钱包，第三方无法验证
- **适合**: 开发测试阶段、上线初期

### 方案 B: 部署到 0G Chain + 接入官方 TEE
- **优点**: 真正的 TEE 安全性，可接入 AIverse 市场
- **缺点**: 需要 0G 开放 TEE API，签名格式需对齐
- **适合**: 生产上线、需要第三方信任时

### 方案 C: 双链部署
- Base 上保留核心 NFT（用户 gas 便宜）
- 0G Chain 上部署镜像合约用于 TEE 验证
- 跨链桥同步状态
- **复杂度最高，暂不推荐**

---

## 十、关键联系人和资源

### 0G 团队
- **@Sphinx** — DC 团队成员
- **@Taybew (Ø,G)** — DC 团队成员
- **Venessa** — 华语生态联系人（推特）
- **Dragon** — 华语生态联系人（推特）
- **Wilbert957 (Wei Wu)** — 0g-agent-nft 和 0g-tapp 主要开发者（GitHub）

### 文档链接
- 0G 文档: https://docs.0g.ai/
- ERC-7857 规范: https://docs.0g.ai/developer-hub/building-on-0g/inft/erc7857
- 集成指南: https://docs.0g.ai/developer-hub/building-on-0g/inft/integration
- 0g-agent-nft: https://github.com/0gfoundation/0g-agent-nft
- 0g-tapp: https://github.com/0gfoundation/0g-tapp
- Tapp 架构文档: https://0g-labs.notion.site/0G-Tapp-2bed6515e143809dbf54df5477fd3db4
- Tapp 博客: https://0g.ai/blog/0g-tapp-tee-security-without-ssh
- B站教程: https://space.bilibili.com/1152852334/lists/6693134
- 0G 中文推特: https://x.com/0g_CN/status/2027246746238411132
- StorageScan: https://storagescan.0g.ai/ (mainnet), https://storagescan-galileo.0g.ai/ (testnet)

### 我们的仓库
- GitHub: https://github.com/0xPanty/ENGRAM
- Vercel: https://engram-five.vercel.app
- Base Sepolia 合约 (v2, ERC-721): `0x3f19619cfa3fc97fbec5c6eab1cccd6c8efb6743`
- Base Sepolia 合约 (v3, ERC-7857): `0x57f3a2b9023d3883b3d51d90da3865bf5a873859`

---

## 十一、文件索引（本项目 ERC-7857 相关）

```
soulclaw/
├── contracts/
│   ├── SoulClawV3.sol              # ERC-7857 主合约
│   ├── SoulClawVerifier.sol        # ECDSA 签名验证器（可换 oracle）
│   ├── MockVerifier.sol            # 测试用 mock 验证器
│   └── interfaces/
│       ├── IERC7857.sol            # ERC-7857 接口
│       └── IERC7857DataVerifier.sol # Verifier 接口
├── test/
│   └── SoulClawV3.ts              # 42 个测试（16 个 ERC-7857 新测试）
├── scripts/
│   ├── deploy-v3-env.mjs          # V3 部署脚本（环境变量方式）
│   ├── test-itransfer.mjs         # iTransfer 测试（有 nonce bug）
│   ├── test-itransfer2.mjs        # iTransfer 测试（修复 nonce）
│   └── test-itransfer3.mjs        # iTransfer 测试（用已部署合约，成功）
└── 0G-TEE-RESEARCH.md             # 本文档
```

---

## 十二、Dev 回复关键信息（2026-03-25 更新）

### 12.1 Dev (Dragon) 确认的信息

**来源**: X DM 对话，Dragon 是 0G APAC DevRel

1. **API 端点已确认**: `POST /generate-proof`
   - 输入: ECDH 加密的 JSON (dataHash + Oracle 加密的 data key + 收件人公钥)
   - 输出: sealedKey + 签名 (TEE proof)
   - 调用前需要先通过 gRPC 获取 Oracle 公钥来加密 data key

2. **目前没有公开 SDK**，Oracle Service 还是内部服务

3. **没有公开 testnet endpoint**，但 dev 表示"确认能否给我们开一个测试节点"

4. **跨链明确兼容** — proof 是标准 secp256k1 ECDSA 签名，链上验证只需 ecrecover，跟目标链无关。可以在 Base Sepolia 部署 TeeVerifier.sol，配 Oracle 的 ETH 地址即可

5. **ERC-7857 iNFT 即将更名为 Agentic ID**（下周官宣），0G 将大面积鼓励开发者在此组件上做商业模式尝试

6. **我们的架构被确认成立**: "0G Storage 存数据、ERC-7857 做资产封装、TEE Oracle 做交易时的安全重加密——这个组合是成立的"

7. **瓶颈是 Oracle 服务的可访问性**，不是技术可行性

### 12.2 Oracle 官方技术文档（内部文档，Dragon 提供）

**文档地址**: https://0g-labs.notion.site/ERC7857-Oracle-2bdd6515e14380b9b325de8bf780e5db

#### 12.2.1 TransferValidityProof 完整结构

```
transferValidityProof = {
    ownershipProof: {
        semanticProof,      // 语义证明（可选）— 证明数据有价值
        keyDeliveryProof    // 密钥交付证明（必需）— 证明密钥正确交付给买家
    },
    dataAvailabilityProof   // 数据可用性证明 — 通过 0G DA 或全量下载证明
}
```

**两层证明体系：**
- **基础确信度**: 只用 keyDeliveryProof（保证买家能解密，但不保证数据有价值）
- **高确信度**: keyDeliveryProof + semanticProof（TEE 验证数据可解密且功能正常 + 买家可先试用）

**对 SoulClaw 的影响**: Dev 说 semanticProof "留给你们自己定义，可以后面再做"。我们先实现 keyDeliveryProof 即可。

#### 12.2.2 密钥体系（Mint 流程）

```
K_random = random_scalar()                    # 随机标量
K_point  = K_random × G                       # 椭圆曲线点
K_master = hash(K_point.x)                    # 主密钥
K_enc    = KDF(K_master, "encryption")        # 加密密钥（对称加密 metadata）
K_mac    = KDF(K_master, "mac")               # 认证密钥（HMAC）
```

**Mint 时：**
1. 生成 K_random → K_point → K_master
2. 用 K_enc 对原始数据 P 加密 → 密文 C
3. 用 K_mac 计算 HMAC(K_mac, C) → 认证标签 T
4. datahash = H(C, T)，上传到 0G Storage
5. 卖家保存 K_random 或 K_point + K_master

**与我们当前实现的差异：**
- 我们用的是 scrypt + AES-256-GCM（用户密语派生密钥）
- 0G 官方用的是 random scalar → 椭圆曲线 → KDF 派生
- 我们的方案需要用户记住密语，0G 的方案密钥完全由随机数生成
- **不冲突**：我们可以在用户层保留密语方案（UX），底层用 0G 的密钥体系做 iTransfer

#### 12.2.3 密钥交付证明（Key Delivery Proof）— 核心流程

**使用 ElGamal 加密方案：**

```
# 卖家（或 TEE）加密 K_point 给买家
R = r × G                          # r 是随机数
S = K_point + r × buyer_pubkey     # ElGamal 加密
C_km = (R, S)                      # 加密后的密钥材料（sealedKey）

# 买家解密
K_point = S - buyer_priv × R       # 用自己的私钥解密
K_master = hash(K_point.x)         # 恢复主密钥
```

**可以用 TEE 或 ZKP 实现：**
- TEE：TEE 内部执行加密 + 签名
- ZKP：ZKP 电路证明加密的正确性（~5000-15000 约束，复杂度可控）

#### 12.2.4 语义证明（Semantic Proof）— 可选

**问题**: 解密成功 ≠ 数据有效（卖家可以用错误的密钥，密码学上"成功解密"但数据是垃圾）

**解决方案**: TEE 可信体验环境
1. TEE 加载 metadata（解密后的 P）
2. 启动实例（如 Agent runtime）
3. 提供受限 API 供买家试用
4. 买家体验后决定是否购买
5. metadata 明文永不离开 TEE

**对 SoulClaw**: 可以后做。先实现基础确信度（keyDeliveryProof only）。

#### 12.2.5 实际调用 Oracle 的流程（综合 dev 回复 + 文档推断）

```
1. 通过 gRPC 获取 Oracle 公钥
2. 卖家用 Oracle 公钥加密自己的 K_master（或 K_point）
3. POST /generate-proof:
   输入: {
     dataHash,                    // 当前 datahash
     encryptedKey,               // 用 Oracle 公钥加密的 data key
     buyerPubkey                 // 买家的公钥
   }
   输出: {
     sealedKey (C_km),           // 用买家公钥加密的 K_point (ElGamal)
     signature                   // Oracle 的 ECDSA 签名
   }
4. 构造 TransferValidityProof 调用合约 iTransferFrom
5. 合约调用 Verifier → TEEVerifier → ecrecover 验证签名
6. 验证通过 → 转移 NFT + 更新 dataHash + 发布 sealedKey
7. 买家用私钥解密 sealedKey → 得到 K_point → K_master → 解密 metadata
```

#### 12.2.6 签名格式详解（来自 Verifier.sol 源码）

**Ownership Proof 签名**:
```
message = keccak256(abi.encodePacked(
    ownershipProof.dataHash,
    ownershipProof.sealedKey,
    ownershipProof.targetPubkey,
    ownershipProof.nonce
))
messageHash = keccak256(abi.encodePacked(
    "\x19Ethereum Signed Message:\n66",
    Strings.toHexString(uint256(message), 32)
))
// TEE Oracle 对 messageHash 签名
```

**Access Proof 签名**:
```
message = keccak256(abi.encodePacked(
    accessProof.dataHash,
    accessProof.targetPubkey,
    accessProof.nonce
))
messageHash = keccak256(abi.encodePacked(
    "\x19Ethereum Signed Message:\n66",
    Strings.toHexString(uint256(message), 32)
))
// 买家（receiver）对 messageHash 签名
```

**注意**: 这个签名格式跟标准 EIP-191 不同！用的是 `"\x19Ethereum Signed Message:\n66"` + hex string，不是 `"\x19Ethereum Signed Message:\n32"` + raw bytes。我们的 SoulClawVerifier 需要适配这个格式。

### 12.3 与我们当前实现的对比

| 方面 | 0G 官方方案 | 我们当前实现 | 需要改动？ |
|---|---|---|---|
| 密钥生成 | random scalar → EC point → KDF | 用户密语 → scrypt → AES key | 可共存，iTransfer 层用 0G 方案 |
| 加密算法 | KDF 派生 K_enc + K_mac | AES-256-GCM | 需要增加 K_mac/HMAC 层 |
| sealedKey | ElGamal 加密 K_point | 简单 ECDSA mock | 需要改为 ElGamal |
| 签名格式 | `\x19...\n66` + hex string | 标准 toEthSignedMessageHash | **需要适配** |
| Verifier | 两层（Verifier → TEEVerifier） | 单层 SoulClawVerifier | 可以适配 |
| Proof 结构 | AccessProof + OwnershipProof 嵌套 | 扁平 TransferValidityProof | **需要重构** |

### 12.4 行动项

1. **等 dev 确认是否能开放测试节点** — 这是最关键的
2. **适配签名格式** — 改 SoulClawVerifier 的签名验证逻辑匹配 0G 格式
3. **适配 Proof 结构** — 改 SoulClawV3 的 iTransferFrom 接受 AccessProof + OwnershipProof
4. **实现 ElGamal 密钥交付** — 前端/后端需要实现 ElGamal 加密/解密
5. **部署到 0G Mainnet** — 黑客松硬性要求
6. **先用 mock oracle 走完完整流程** — 不等真实 TEE，用我们自己的钱包模拟 Oracle 签名（已有）

---

## 十三、Tapp 中文文档

Dev 还提供了 0G Tapp 中文文档链接：
https://0g-labs.notion.site/0G-Tapp-ZH-2bdd6515e14380d8ae6ad745906f6d2c

---

## 十四、时间线

| 日期 | 事件 |
|---|---|
| 2026-03-18 | Phase A (ERC-721) 后端 100% 完成 |
| 2026-03-19 | Session 4: Engram 多版本系统 + RPM fork |
| 2026-03-20 | Session 5: ERC-7857 升级 + SoulClawV3 部署 Base Sepolia + iTransfer E2E 通过 |
| 2026-03-20 | 开始 0G TEE Oracle 研究，与 DC mod 沟通 |
| 2026-03-20 | 发现 0g-agent-nft 仓库 + 链上合约分析 |
| 2026-03-20 | 发现 0g-tapp 仓库（TEE 基础设施） |
| 2026-03-20 | 与 Dragon (Dev) 建立 X DM 联系 |
| 2026-03-23 | Dragon 回复：确认 API 存在 + 跨链兼容 + 可能开放测试节点 |
| 2026-03-25 | Dragon 发送 Oracle 内部技术文档（Notion） |
| 2026-03-25 | 确认 ERC-7857 即将更名为 Agentic ID |
| 2026-04-初 | 黑客松线上 checkpoint |
| 2026-05-09 | 黑客松提交截止 |
