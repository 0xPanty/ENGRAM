# SoulClaw Project Memory

## Deployed Contracts

### 0G Mainnet (chain 16661)
- SoulClawVerifier: `0xD56e98D9BDbd08bEb54Ce6729D1dC1B46Cf4763E`
- SoulClawV3: `0xc17bf8328077ead290c3ee39d37fab46699e465e`
- Oracle (mock): `0xF9028f6269E84ADbB6a418C0dFB77d766C263Ddd` (deployer wallet)
- Deployed: 2026-03-25

### Base Sepolia (legacy test)
- Old V3 + MockVerifier deployed (pre-0G-format)
- E2E iTransfer test passed on 2026-03-20

## Deployer Wallet
- Address: `0xF9028f6269E84ADbB6a418C0dFB77d766C263Ddd`
- Has balance on both 0G Mainnet and 0G Testnet (16602)

## Key Decisions

### 2026-03-20: ERC-7857 Upgrade
- Upgraded from plain ERC-721 to ERC-7857
- Deployed with MockVerifier first to validate flow
- All 42 original tests pass + 16 new ERC-7857 tests

### 2026-03-25: 0G Proof Structure Alignment
- Rewrote proof structure to match 0G official: AccessProof + OwnershipProof nested
- Adapted signature format to 0G's `\x19Ethereum Signed Message:\n66` + hex string
- dataHash no longer changes on transfer (matches 0G design: key re-delivery)
- Added accessAssistant validation (receiver or delegate)
- 50 tests passing

### 2026-03-25: 0G Mainnet Deployment
- Deployed SoulClawVerifier + SoulClawV3 to 0G Mainnet
- Oracle address set to deployer wallet (mock) — switch when TEE Oracle available
- `verifier.setOracleAddress(teeOracleAddr)` to switch

## 0G TEE Oracle Status
- Dragon (0G APAC DevRel) is our contact
- Oracle API: `POST /generate-proof` (not yet public)
- Waiting for test node access
- Cross-chain confirmed: proof is secp256k1 ECDSA, works on any EVM chain
- ERC-7857 renaming to "Agentic ID" (announced ~2026-03-25)

## ERC-7857 Proof Structure
```
TransferValidityProof = {
    accessProof: { dataHash, targetPubkey, nonce, proof },      // receiver signs
    ownershipProof: { oracleType, dataHash, sealedKey, targetPubkey, nonce, proof }  // oracle signs
}
```

## Key System (from 0G Oracle docs)
```
K_random → K_point = K_random × G → K_master = hash(K_point.x)
K_enc = KDF(K_master, "encryption")
K_mac = KDF(K_master, "mac")
datahash = H(C, T) where C = Encrypt(K_enc, P), T = HMAC(K_mac, C)
sealedKey = ElGamal(K_point, buyer_pubkey)
```

## Hackathon
- 0G APAC Hackathon: $150K prize pool, deadline May 9, 2026
- Track 1 (Agentic Infrastructure & OpenClaw Labs) fits SoulClaw
- Requirement: 0G mainnet deployment (DONE) + verified on-chain activity

### 2026-03-26: ERC-8004 (Trustless Agents) Integration
- Added AgentRegistry.sol (ERC-8004 Identity Registry, ERC-721 based)
- Added ReputationRegistry.sol (ERC-8004 Reputation Registry, feedback/scoring)
- Modified SoulClawV3.sol: auto-registers agent in 8004 on mintSoul/mintSoulFor
- One mint = two NFTs (Soul NFT 7857 + Agent ID 8004), single transaction
- hardhat.config.ts: enabled viaIR: true (stack too deep fix)
- 37/37 tests passing (24 original + 13 new ERC-8004 tests)
- NFT visual plan: 7857 = pixel avatar (agent self-selected), 8004 = ID card (on-chain SVG, cyberpunk style, TBD)

### 2026-03-26: Web4 Technology Stack Research (conceptual, not finalized)
- Layer 1 (Persistence): 0G Storage + Base Chain + ERC-7857
- Layer 2 (Identity): ERC-8004 (Identity + Reputation + Validation)
- Layer 3 (Perception): nkmc.ai gateway (Agent calls real-world APIs)
- Layer 4 (Economy): x402 (Coinbase HTTP micropayments) + MPP (Stripe/Tempo agent payments) + AP2 (Google structured payments)
- Layer 5 (Physical): Pixel game world + World NFTs
- Coinbase Agentic Wallets for NPC self-custody
- AP2 and Autonomys evaluated but low priority / not needed

### 2026-03-26: Game Engine Decision
- RPG Paper Maker: installed locally, source code at Desktop\RPM\, 2.5D editor
- godot-2d-lite: custom Godot-based 2D editor at C:\Users\Administrator\godot-2d-lite\, 5 milestones complete (map/events/dialogue/inventory/quests/save/animation/scenes/AI)
- AuraJS (auramaxx): terminal game engine, JS+Rust, npm distribution
- RPG Maker MZ/MV: commercial, best for quick RPG demo but needs purchase
- Decision pending: user evaluating RPG Paper Maker vs godot-2d-lite
- ClawVerse PRD exists at Desktop\ClawVerse\ (full game design doc)
- Microverse reference at C:\Users\Administrator\Microverse\ (Stanford AI town style)

## Deployed Contracts (updated)

### 0G Mainnet (chain 16661)
- SoulClawVerifier: `0xD56e98D9BDbd08bEb54Ce6729D1dC1B46Cf4763E`
- SoulClawV3: `0xc17bf8328077ead290c3ee39d37fab46699e465e`
- Oracle (mock): `0xF9028f6269E84ADbB6a418C0dFB77d766C263Ddd`
- AgentRegistry + ReputationRegistry: NOT YET DEPLOYED (code ready, tests passing)

### Base Sepolia
- SoulClaw v2 (ERC-721): `0x3f19619cfa3fc97fbec5c6eab1cccd6c8efb6743`
- SoulClawV3 (ERC-7857): `0x57f3a2b9023d3883b3d51d90da3865bf5a873859`
- SoulClawVerifier: `0x0B0e2C1295985beF30c502B7D9A70910d8A98FE1`

## Key Documents
- **Full progress doc**: `C:\Users\Administrator\Desktop\ENGRAM-progress.md` (Sessions 1-5 complete history)
- **Project spec**: `C:\Users\Administrator\Desktop\SoulClaw-项目定稿.md`
- **0G TEE research**: `C:\Users\Administrator\Desktop\soulclaw\0G-TEE-RESEARCH.md`
- **ClawVerse game PRD**: `C:\Users\Administrator\Desktop\ClawVerse\ClawVerse-PRD.md`
- **godot-2d-lite status**: `C:\Users\Administrator\godot-2d-lite\STATUS.md` + `HANDOFF.md`

## Pending Work
1. Deploy AgentRegistry + ReputationRegistry to Base Sepolia / 0G Mainnet
2. Game demo (engine TBD: RPG Paper Maker or godot-2d-lite)
3. Frontend UI (landing/backup/restore/dashboard)
4. On-chain activity on 0G Mainnet for hackathon
5. Real TEE Oracle integration when test node opens
6. ElGamal key delivery implementation
7. 8004 Agent NFT on-chain SVG ID card design

## Hackathon
- 0G APAC Hackathon: $150K prize pool, deadline May 9, 2026
- Online checkpoint: early April 2026
- ~6 weeks remaining
- Track 1 (Agentic Infrastructure & OpenClaw Labs) fits SoulClaw
- Requirement: 0G mainnet deployment (DONE) + verified on-chain activity
