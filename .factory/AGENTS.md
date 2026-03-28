# SoulClaw

On-chain AI soul protocol — ERC-721 + ERC-7857 (Agentic ID) with 0G Storage + TEE Oracle.

## Core Commands

- Compile: `npx hardhat compile`
- Test: `npx hardhat test` (50 tests)
- Deploy 0G Mainnet: `node scripts/deploy-0g-mainnet.mjs`
- Deploy Base Sepolia: `node scripts/deploy-v3-env.mjs`

## Project Layout

```
contracts/
  SoulClawV3.sol              # Main contract (ERC-721 + ERC-2981 + ERC-7857)
  SoulClawVerifier.sol         # 0G-compatible verifier
  MockVerifier.sol             # Testing verifier
  interfaces/
    IERC7857DataVerifier.sol   # 0G-aligned proof interface
    IERC7857.sol               # ERC-7857 interface
test/
  SoulClawV3.ts                # 50 tests
scripts/
  deploy-0g-mainnet.mjs        # 0G mainnet deploy
  deploy-v3-env.mjs            # Base Sepolia deploy
```

## Conventions

- Solidity 0.8.28, Hardhat, viem, TypeScript
- OpenZeppelin (ERC-721, ERC-2981, ECDSA, Ownable)
- Private key in `.env` as `DEPLOYER_KEY` — never expose in logs
- Always compile + test after contract changes

## Architecture

- Contracts on **0G Mainnet** (chain 16661, RPC: `https://evmrpc.0g.ai`)
- Data storage: 0G Distributed Storage
- Transfer security: TEE Oracle re-encryption (0G infrastructure)
- 0G signature format: `keccak256("\x19Ethereum Signed Message:\n66" + hexString(innerHash))` — NOT standard EIP-191
- dataHash does NOT change on iTransfer (key re-delivery, not re-encryption)

## Project Memory

Deployed addresses, research, and detailed technical context in `.factory/memories.md`.
Full 0G TEE Oracle research in `0G-TEE-RESEARCH.md`.
