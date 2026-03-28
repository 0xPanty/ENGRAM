// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./interfaces/IAgentRegistry.sol";

/// @title AgentRegistry - ERC-8004 Identity Registry
/// @notice ERC-721-based agent discovery registry. Each agent gets a portable on-chain identity.
contract AgentRegistry is ERC721, EIP712, IAgentRegistry {
    using ECDSA for bytes32;

    uint256 private _nextAgentId;

    mapping(uint256 => string) private _agentURIs;
    mapping(uint256 => mapping(string => bytes)) private _metadata;
    mapping(uint256 => address) private _agentWallets;

    bytes32 private constant WALLET_TYPEHASH =
        keccak256("SetAgentWallet(uint256 agentId,address newWallet,uint256 deadline)");

    error AgentNotExist();
    error NotAgentOwner();
    error ReservedKey();
    error DeadlineExpired();
    error InvalidWalletSignature();

    constructor() ERC721("AgentRegistry", "AGENT") EIP712("AgentRegistry", "1") {}

    // ============ Registration ============

    function register(
        string calldata agentURI,
        MetadataEntry[] calldata metadata
    ) external returns (uint256 agentId) {
        agentId = _registerInternal(msg.sender, agentURI);
        for (uint i = 0; i < metadata.length; i++) {
            if (_isReservedKey(metadata[i].metadataKey)) revert ReservedKey();
            _metadata[agentId][metadata[i].metadataKey] = metadata[i].metadataValue;
            emit MetadataSet(agentId, metadata[i].metadataKey, metadata[i].metadataKey, metadata[i].metadataValue);
        }
    }

    function register(string calldata agentURI) external returns (uint256 agentId) {
        agentId = _registerInternal(msg.sender, agentURI);
    }

    function register() external returns (uint256 agentId) {
        agentId = _registerInternal(msg.sender, "");
    }

    /// @notice Register on behalf of another address (for integration contracts like SoulClawV3)
    function registerFor(address owner, string memory agentURI) external returns (uint256 agentId) {
        agentId = _registerInternal(owner, agentURI);
    }

    function _registerInternal(address owner, string memory agentURI) internal returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(owner, agentId);
        _agentURIs[agentId] = agentURI;
        _agentWallets[agentId] = owner;
        emit MetadataSet(agentId, "agentWallet", "agentWallet", abi.encodePacked(owner));
        emit Registered(agentId, agentURI, owner);
    }

    // ============ URI ============

    function setAgentURI(uint256 agentId, string calldata newURI) external {
        _requireOwnerOrApproved(agentId);
        _agentURIs[agentId] = newURI;
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert AgentNotExist();
        return _agentURIs[tokenId];
    }

    // ============ Metadata ============

    function setMetadata(uint256 agentId, string calldata metadataKey, bytes calldata metadataValue) external {
        _requireOwnerOrApproved(agentId);
        if (_isReservedKey(metadataKey)) revert ReservedKey();
        _metadata[agentId][metadataKey] = metadataValue;
        emit MetadataSet(agentId, metadataKey, metadataKey, metadataValue);
    }

    function getMetadata(uint256 agentId, string calldata metadataKey) external view returns (bytes memory) {
        if (_ownerOf(agentId) == address(0)) revert AgentNotExist();
        return _metadata[agentId][metadataKey];
    }

    // ============ Agent Wallet (EIP-712 verified) ============

    function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata signature) external {
        _requireOwnerOrApproved(agentId);
        if (block.timestamp > deadline) revert DeadlineExpired();

        bytes32 structHash = keccak256(abi.encode(WALLET_TYPEHASH, agentId, newWallet, deadline));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);
        if (signer != newWallet) revert InvalidWalletSignature();

        _agentWallets[agentId] = newWallet;
        emit MetadataSet(agentId, "agentWallet", "agentWallet", abi.encodePacked(newWallet));
    }

    function getAgentWallet(uint256 agentId) external view returns (address) {
        if (_ownerOf(agentId) == address(0)) revert AgentNotExist();
        return _agentWallets[agentId];
    }

    function unsetAgentWallet(uint256 agentId) external {
        _requireOwnerOrApproved(agentId);
        _agentWallets[agentId] = address(0);
        emit MetadataSet(agentId, "agentWallet", "agentWallet", abi.encodePacked(address(0)));
    }

    // ============ Transfer hook: clear agentWallet ============

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = super._update(to, tokenId, auth);
        if (from != address(0) && to != address(0)) {
            _agentWallets[tokenId] = address(0);
        }
        return from;
    }

    // ============ View ============

    function totalSupply() external view returns (uint256) {
        return _nextAgentId;
    }

    // ============ Internal ============

    function _requireOwnerOrApproved(uint256 agentId) internal view {
        if (_ownerOf(agentId) == address(0)) revert AgentNotExist();
        if (
            _ownerOf(agentId) != msg.sender &&
            getApproved(agentId) != msg.sender &&
            !isApprovedForAll(_ownerOf(agentId), msg.sender)
        ) {
            revert NotAgentOwner();
        }
    }

    function _isReservedKey(string memory key) internal pure returns (bool) {
        return keccak256(bytes(key)) == keccak256(bytes("agentWallet"));
    }
}
