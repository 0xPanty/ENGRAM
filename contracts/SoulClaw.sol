// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract SoulClaw is ERC721, ERC2981, Ownable {
    using Strings for uint256;

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

    uint256 private _nextTokenId;
    uint256 public mintPrice = 0.001 ether;
    mapping(uint256 => SoulData) private _souls;
    mapping(address => bool) private _hasMinted;

    event SoulMinted(uint256 indexed tokenId, address indexed owner, bytes32 dataHash);
    event SoulUpdated(uint256 indexed tokenId, bytes32 oldHash, bytes32 newHash, uint256 version);
    event SkillsUpdated(uint256 indexed tokenId, string[] skills);

    constructor() ERC721("SoulClaw", "SOUL") Ownable(msg.sender) {
        _setDefaultRoyalty(msg.sender, 500); // 5%
    }

    function mintSoul(
        bytes32 dataHash,
        string calldata arweaveTxId,
        string calldata imageUri,
        string calldata soulSummary,
        string calldata soulStatement,
        string[] memory skills
    ) external payable returns (uint256) {
        require(!_hasMinted[msg.sender], "Already minted");
        require(msg.value >= mintPrice, "Insufficient mint fee");

        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _hasMinted[msg.sender] = true;

        _souls[tokenId] = SoulData({
            dataHash: dataHash,
            arweaveTxId: arweaveTxId,
            imageUri: imageUri,
            soulSummary: soulSummary,
            soulStatement: soulStatement,
            skills: skills,
            version: 1,
            lastUpdated: block.timestamp
        });

        emit SoulMinted(tokenId, msg.sender, dataHash);
        return tokenId;
    }

    function updateSoul(
        uint256 tokenId,
        bytes32 newDataHash,
        string calldata newArweaveTxId,
        string calldata newImageUri,
        string calldata newSoulSummary,
        string calldata newSoulStatement
    ) external {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        SoulData storage soul = _souls[tokenId];
        bytes32 oldHash = soul.dataHash;

        soul.dataHash = newDataHash;
        soul.arweaveTxId = newArweaveTxId;
        if (bytes(newImageUri).length > 0) soul.imageUri = newImageUri;
        if (bytes(newSoulSummary).length > 0) soul.soulSummary = newSoulSummary;
        if (bytes(newSoulStatement).length > 0) soul.soulStatement = newSoulStatement;
        soul.version++;
        soul.lastUpdated = block.timestamp;

        emit SoulUpdated(tokenId, oldHash, newDataHash, soul.version);
    }

    function updateSkills(uint256 tokenId, string[] memory newSkills) external {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        _souls[tokenId].skills = newSkills;
        _souls[tokenId].lastUpdated = block.timestamp;
        emit SkillsUpdated(tokenId, newSkills);
    }

    function getSoulData(uint256 tokenId) external view returns (SoulData memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return _souls[tokenId];
    }

    function hasMinted(address account) external view returns (bool) {
        return _hasMinted[account];
    }

    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        SoulData memory soul = _souls[tokenId];

        string memory attrs = "";
        for (uint i = 0; i < soul.skills.length; i++) {
            if (bytes(attrs).length > 0) attrs = string.concat(attrs, ",");
            attrs = string.concat(
                attrs,
                '{"trait_type":"Skill","value":"', soul.skills[i], '"}'
            );
        }
        if (bytes(attrs).length > 0) attrs = string.concat(attrs, ",");
        attrs = string.concat(
            attrs,
            '{"trait_type":"Version","display_type":"number","value":', soul.version.toString(), '}'
        );

        string memory json = string.concat(
            '{"name":"SoulClaw #', tokenId.toString(),
            '","description":"', soul.soulStatement,
            '","image":"', soul.imageUri,
            '","external_url":"https://soulclaw.xyz/soul/', tokenId.toString(),
            '","attributes":[', attrs, ']}'
        );

        return string.concat(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        );
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC2981) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function setMintPrice(uint256 newPrice) external onlyOwner {
        mintPrice = newPrice;
    }

    // OPERATOR 代用户 mint，NFT 归属 to 地址
    function mintSoulFor(
        address to,
        bytes32 dataHash,
        string calldata arweaveTxId,
        string calldata imageUri,
        string calldata soulSummary,
        string calldata soulStatement,
        string[] memory skills
    ) external payable onlyOwner returns (uint256) {
        require(!_hasMinted[to], "Already minted");
        require(msg.value >= mintPrice, "Insufficient mint fee");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _hasMinted[to] = true;

        _souls[tokenId] = SoulData({
            dataHash: dataHash,
            arweaveTxId: arweaveTxId,
            imageUri: imageUri,
            soulSummary: soulSummary,
            soulStatement: soulStatement,
            skills: skills,
            version: 1,
            lastUpdated: block.timestamp
        });

        emit SoulMinted(tokenId, to, dataHash);
        return tokenId;
    }

    // OPERATOR 代用户更新灵魂数据
    function updateSoulFor(
        address soulOwner,
        uint256 tokenId,
        bytes32 newDataHash,
        string calldata newArweaveTxId,
        string calldata newImageUri,
        string calldata newSoulSummary,
        string calldata newSoulStatement
    ) external onlyOwner {
        require(ownerOf(tokenId) == soulOwner, "Not owner of token");
        SoulData storage soul = _souls[tokenId];
        bytes32 oldHash = soul.dataHash;

        soul.dataHash = newDataHash;
        soul.arweaveTxId = newArweaveTxId;
        if (bytes(newImageUri).length > 0) soul.imageUri = newImageUri;
        if (bytes(newSoulSummary).length > 0) soul.soulSummary = newSoulSummary;
        if (bytes(newSoulStatement).length > 0) soul.soulStatement = newSoulStatement;
        soul.version++;
        soul.lastUpdated = block.timestamp;

        emit SoulUpdated(tokenId, oldHash, newDataHash, soul.version);
    }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}
