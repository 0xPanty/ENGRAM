// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IERC7857DataVerifier.sol";

/// @notice Mock verifier that approves all proofs. For testing only.
contract MockVerifier is IERC7857DataVerifier {
    function verifyTransferValidity(
        TransferValidityProof[] calldata proofs
    ) external pure override returns (TransferValidityProofOutput[] memory) {
        TransferValidityProofOutput[] memory outputs = new TransferValidityProofOutput[](proofs.length);
        for (uint i = 0; i < proofs.length; i++) {
            AccessProof calldata ap = proofs[i].accessProof;
            OwnershipProof calldata op = proofs[i].ownershipProof;
            outputs[i] = TransferValidityProofOutput({
                dataHash: ap.dataHash,
                sealedKey: op.sealedKey,
                targetPubkey: op.targetPubkey,
                wantedKey: ap.targetPubkey,
                accessAssistant: address(0),
                accessProofNonce: ap.nonce,
                ownershipProofNonce: op.nonce
            });
        }
        return outputs;
    }
}
