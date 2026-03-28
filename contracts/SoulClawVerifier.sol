// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IERC7857DataVerifier.sol";

/// @notice Verifier compatible with 0G TEE Oracle signature format.
/// Uses the same signing scheme as 0G's Verifier.sol:
///   messageHash = keccak256("\x19Ethereum Signed Message:\n66" + toHexString(keccak256(payload)))
/// Set oracleAddress to 0G TEE oracle when available, or use own key for testing.
contract SoulClawVerifier is IERC7857DataVerifier, Ownable {
    using ECDSA for bytes32;

    address public oracleAddress;
    uint256 public maxProofAge = 7 days;

    mapping(bytes32 => bool) public usedProofs;
    mapping(bytes32 => uint256) public proofTimestamps;

    event OracleAddressUpdated(address indexed oldOracle, address indexed newOracle);

    constructor(address _oracleAddress) Ownable(msg.sender) {
        require(_oracleAddress != address(0), "Invalid oracle");
        oracleAddress = _oracleAddress;
    }

    function setOracleAddress(address _newOracle) external onlyOwner {
        require(_newOracle != address(0), "Invalid oracle");
        address old = oracleAddress;
        oracleAddress = _newOracle;
        emit OracleAddressUpdated(old, _newOracle);
    }

    function setMaxProofAge(uint256 _maxProofAge) external onlyOwner {
        maxProofAge = _maxProofAge;
    }

    /// @notice 0G-compatible signature hash: keccak256("\x19Ethereum Signed Message:\n66" + hexString(keccak256(payload)))
    function _toOGSignedHash(bytes32 innerHash) internal pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n66",
                Strings.toHexString(uint256(innerHash), 32)
            )
        );
    }

    function _checkAndMarkProof(bytes32 proofNonce) internal {
        require(!usedProofs[proofNonce], "Proof already used");
        usedProofs[proofNonce] = true;
        proofTimestamps[proofNonce] = block.timestamp;
    }

    /// @notice Verify access proof: receiver signs (dataHash, targetPubkey, nonce)
    function _verifyAccessibility(AccessProof calldata ap) internal pure returns (address) {
        bytes32 innerHash = keccak256(
            abi.encodePacked(ap.dataHash, ap.targetPubkey, ap.nonce)
        );
        bytes32 messageHash = _toOGSignedHash(innerHash);
        address signer = messageHash.recover(ap.proof);
        require(signer != address(0), "Invalid access proof");
        return signer;
    }

    /// @notice Verify ownership proof: oracle signs (dataHash, sealedKey, targetPubkey, nonce)
    function _verifyOwnershipProof(OwnershipProof calldata op) internal view returns (bool) {
        if (op.oracleType == OracleType.TEE) {
            bytes32 innerHash = keccak256(
                abi.encodePacked(op.dataHash, op.sealedKey, op.targetPubkey, op.nonce)
            );
            bytes32 messageHash = _toOGSignedHash(innerHash);
            address signer = messageHash.recover(op.proof);
            return signer == oracleAddress;
        }
        // ZKP not implemented yet
        return false;
    }

    function verifyTransferValidity(
        TransferValidityProof[] calldata proofs
    ) external override returns (TransferValidityProofOutput[] memory) {
        TransferValidityProofOutput[] memory outputs = new TransferValidityProofOutput[](proofs.length);

        for (uint i = 0; i < proofs.length; i++) {
            AccessProof calldata ap = proofs[i].accessProof;
            OwnershipProof calldata op = proofs[i].ownershipProof;

            require(ap.dataHash == op.dataHash, "DataHash mismatch");

            // Verify access proof (receiver signature)
            address accessAssistant = _verifyAccessibility(ap);

            // Verify ownership proof (oracle signature)
            require(_verifyOwnershipProof(op), "Invalid ownership proof");

            // Prevent replay — hash nonce with msg.sender (same as 0G)
            bytes32 accessNonce = keccak256(abi.encode(ap.nonce, msg.sender));
            _checkAndMarkProof(accessNonce);

            bytes32 ownershipNonce = keccak256(abi.encode(op.nonce, msg.sender));
            _checkAndMarkProof(ownershipNonce);

            outputs[i] = TransferValidityProofOutput({
                dataHash: ap.dataHash,
                sealedKey: op.sealedKey,
                targetPubkey: op.targetPubkey,
                wantedKey: ap.targetPubkey,
                accessAssistant: accessAssistant,
                accessProofNonce: ap.nonce,
                ownershipProofNonce: op.nonce
            });
        }

        return outputs;
    }

    /// @notice Clean expired proof records to save gas
    function cleanExpiredProofs(bytes32[] calldata proofNonces) external {
        for (uint256 i = 0; i < proofNonces.length; i++) {
            bytes32 nonce = proofNonces[i];
            if (usedProofs[nonce] && block.timestamp > proofTimestamps[nonce] + maxProofAge) {
                delete usedProofs[nonce];
                delete proofTimestamps[nonce];
            }
        }
    }
}
