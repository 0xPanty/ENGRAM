// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Oracle type: TEE or ZKP
enum OracleType {
    TEE,
    ZKP
}

/// @notice Access proof signed by receiver (or delegated access assistant)
struct AccessProof {
    bytes32 dataHash;       // hash of the encrypted data
    bytes targetPubkey;     // receiver's public key (empty = use ETH pubkey)
    bytes nonce;
    bytes proof;            // receiver's ECDSA signature
}

/// @notice Ownership proof signed by TEE Oracle
struct OwnershipProof {
    OracleType oracleType;
    bytes32 dataHash;       // hash of the encrypted data
    bytes sealedKey;        // new data key encrypted with receiver's pubkey (ElGamal)
    bytes targetPubkey;     // receiver's public key
    bytes nonce;
    bytes proof;            // TEE Oracle's ECDSA signature
}

struct TransferValidityProof {
    AccessProof accessProof;
    OwnershipProof ownershipProof;
}

struct TransferValidityProofOutput {
    bytes32 dataHash;
    bytes sealedKey;
    bytes targetPubkey;
    bytes wantedKey;
    address accessAssistant;
    bytes accessProofNonce;
    bytes ownershipProofNonce;
}

interface IERC7857DataVerifier {
    function verifyTransferValidity(
        TransferValidityProof[] calldata proofs
    ) external returns (TransferValidityProofOutput[] memory);
}
