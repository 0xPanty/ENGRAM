// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISoulClaw {
    struct SoulData {
        bytes32 dataHash;
        string arweaveTxId;
        string imageUri;
        string soulSummary;
        string soulStatement;
        string[] skills;
        uint256 version;
        uint256 lastUpdated;
    }

    event SoulMinted(uint256 indexed tokenId, address indexed owner, bytes32 dataHash);
    event SoulUpdated(uint256 indexed tokenId, bytes32 oldHash, bytes32 newHash, uint256 version);
    event SkillsUpdated(uint256 indexed tokenId, string[] skills);

    function mintSoul(
        bytes32 dataHash,
        string calldata arweaveTxId,
        string calldata imageUri,
        string calldata soulSummary,
        string calldata soulStatement,
        string[] memory skills
    ) external payable returns (uint256);

    function updateSoul(
        uint256 tokenId,
        bytes32 newDataHash,
        string calldata newArweaveTxId,
        string calldata newImageUri,
        string calldata newSoulSummary,
        string calldata newSoulStatement
    ) external;

    function updateSkills(uint256 tokenId, string[] memory newSkills) external;

    function getSoulData(uint256 tokenId) external view returns (SoulData memory);

    function mintSoulFor(
        address to,
        bytes32 dataHash,
        string calldata arweaveTxId,
        string calldata imageUri,
        string calldata soulSummary,
        string calldata soulStatement,
        string[] memory skills
    ) external payable returns (uint256);

    function updateSoulFor(
        address soulOwner,
        uint256 tokenId,
        bytes32 newDataHash,
        string calldata newArweaveTxId,
        string calldata newImageUri,
        string calldata newSoulSummary,
        string calldata newSoulStatement
    ) external;
}
