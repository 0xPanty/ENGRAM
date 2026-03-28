// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/IERC7857.sol";
import "./interfaces/IERC7857DataVerifier.sol";
import "./AgentRegistry.sol";

contract SoulClawV3 is ERC721, ERC2981, Ownable, IERC7857 {
    using Strings for uint256;

    // ============ SoulClaw-specific data ============

    struct SoulData {
        bytes32 dataHash;
        string storeTxId;        // 0G Storage root hash
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

    // ============ ERC-7857 data ============

    IERC7857DataVerifier private _verifier;
    mapping(uint256 => address[]) private _authorizedUsers;
    mapping(address => address) private _accessAssistants;

    // ============ ERC-8004 data ============

    AgentRegistry private _agentRegistry;
    mapping(uint256 => uint256) private _tokenToAgentId; // soulTokenId => 8004 agentId
    mapping(address => uint256) private _ownerToAgentId;

    // ============ Events ============

    event SoulMinted(uint256 indexed tokenId, address indexed owner, bytes32 dataHash);
    event SoulUpdated(uint256 indexed tokenId, bytes32 oldHash, bytes32 newHash, uint256 version);
    event SkillsUpdated(uint256 indexed tokenId, string[] skills);
    event AgentRegistered(uint256 indexed tokenId, uint256 indexed agentId, address indexed owner);

    // ============ Errors ============

    error AlreadyMinted();
    error InsufficientFee();
    error NotTokenOwner();
    error TokenNotExist();
    error EmptyProof();
    error ProofCountMismatch();
    error DataHashMismatch();
    error InvalidReceiver();
    error InvalidAccessAssistant();

    // ============ Constructor ============

    constructor(address verifierAddr, address agentRegistryAddr) ERC721("SoulClaw", "SOUL") Ownable(msg.sender) {
        _setDefaultRoyalty(msg.sender, 500); // 5%
        _verifier = IERC7857DataVerifier(verifierAddr);
        _agentRegistry = AgentRegistry(agentRegistryAddr);
    }

    // ============ ERC-7857: Core ============

    function verifier() external view override returns (IERC7857DataVerifier) {
        return _verifier;
    }

    function setVerifier(address newVerifier) external onlyOwner {
        _verifier = IERC7857DataVerifier(newVerifier);
    }

    function intelligentDatasOf(uint256 tokenId) external view returns (IntelligentData[] memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenNotExist();
        SoulData storage soul = _souls[tokenId];
        IntelligentData[] memory datas = new IntelligentData[](1);
        datas[0] = IntelligentData({
            dataDescription: soul.storeTxId,
            dataHash: soul.dataHash
        });
        return datas;
    }

    function iTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        TransferValidityProof[] calldata proofs
    ) external override {
        if (to == address(0)) revert InvalidReceiver();
        if (_ownerOf(tokenId) != from) revert NotTokenOwner();
        if (proofs.length == 0) revert EmptyProof();

        TransferValidityProofOutput[] memory outputs = _verifier.verifyTransferValidity(proofs);
        SoulData storage soul = _souls[tokenId];

        if (outputs.length < 1) revert ProofCountMismatch();
        if (outputs[0].dataHash != soul.dataHash) revert DataHashMismatch();

        // Access assistant must be receiver or their delegate (same as 0G)
        if (outputs[0].accessAssistant != to && outputs[0].accessAssistant != _accessAssistants[to]) {
            revert InvalidAccessAssistant();
        }

        soul.version++;
        soul.lastUpdated = block.timestamp;

        _transfer(from, to, tokenId);

        bytes[] memory sealedKeys = new bytes[](outputs.length);
        for (uint i = 0; i < outputs.length; i++) {
            sealedKeys[i] = outputs[i].sealedKey;
        }

        emit Transferred(tokenId, from, to);
        emit PublishedSealedKey(to, tokenId, sealedKeys);
    }

    function iClone(
        address to,
        uint256 tokenId,
        TransferValidityProof[] calldata proofs
    ) external override returns (uint256 newTokenId) {
        if (to == address(0)) revert InvalidReceiver();
        address tokenOwner = _ownerOf(tokenId);
        if (tokenOwner != msg.sender) revert NotTokenOwner();
        if (proofs.length == 0) revert EmptyProof();

        TransferValidityProofOutput[] memory outputs = _verifier.verifyTransferValidity(proofs);
        SoulData storage originalSoul = _souls[tokenId];

        if (outputs.length < 1) revert ProofCountMismatch();
        if (outputs[0].dataHash != originalSoul.dataHash) revert DataHashMismatch();

        if (outputs[0].accessAssistant != to && outputs[0].accessAssistant != _accessAssistants[to]) {
            revert InvalidAccessAssistant();
        }

        newTokenId = _nextTokenId++;
        _safeMint(to, newTokenId);

        string[] memory clonedSkills = new string[](originalSoul.skills.length);
        for (uint i = 0; i < originalSoul.skills.length; i++) {
            clonedSkills[i] = originalSoul.skills[i];
        }

        _souls[newTokenId] = SoulData({
            dataHash: originalSoul.dataHash,
            storeTxId: originalSoul.storeTxId,
            imageUri: originalSoul.imageUri,
            soulSummary: originalSoul.soulSummary,
            soulStatement: originalSoul.soulStatement,
            skills: clonedSkills,
            version: 1,
            lastUpdated: block.timestamp
        });

        bytes[] memory sealedKeys = new bytes[](outputs.length);
        for (uint i = 0; i < outputs.length; i++) {
            sealedKeys[i] = outputs[i].sealedKey;
        }

        emit Cloned(tokenId, newTokenId, msg.sender, to);
        emit PublishedSealedKey(to, newTokenId, sealedKeys);

        return newTokenId;
    }

    // ============ ERC-7857: Authorization ============

    function authorizeUsage(uint256 tokenId, address user) external override {
        if (_ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        _authorizedUsers[tokenId].push(user);
        emit Authorization(msg.sender, user, tokenId);
    }

    function revokeAuthorization(uint256 tokenId, address user) external override {
        if (_ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        address[] storage users = _authorizedUsers[tokenId];
        for (uint i = 0; i < users.length; i++) {
            if (users[i] == user) {
                users[i] = users[users.length - 1];
                users.pop();
                emit AuthorizationRevoked(msg.sender, user, tokenId);
                return;
            }
        }
    }

    function authorizedUsersOf(uint256 tokenId) external view returns (address[] memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenNotExist();
        return _authorizedUsers[tokenId];
    }

    function delegateAccess(address assistant) external override {
        _accessAssistants[msg.sender] = assistant;
        emit DelegateAccess(msg.sender, assistant);
    }

    function getDelegateAccess(address user) external view returns (address) {
        return _accessAssistants[user];
    }

    // ============ SoulClaw: Mint ============

    function mintSoul(
        bytes32 dataHash,
        string calldata storeTxId,
        string calldata imageUri,
        string calldata soulSummary,
        string calldata soulStatement,
        string[] memory skills
    ) external payable returns (uint256) {
        if (_hasMinted[msg.sender]) revert AlreadyMinted();
        if (msg.value < mintPrice) revert InsufficientFee();

        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _hasMinted[msg.sender] = true;

        _souls[tokenId] = SoulData({
            dataHash: dataHash,
            storeTxId: storeTxId,
            imageUri: imageUri,
            soulSummary: soulSummary,
            soulStatement: soulStatement,
            skills: skills,
            version: 1,
            lastUpdated: block.timestamp
        });

        _registerAgent(msg.sender, tokenId, soulSummary, imageUri);

        emit SoulMinted(tokenId, msg.sender, dataHash);
        return tokenId;
    }

    /// @notice OPERATOR mints on behalf of user, NFT goes to `to`
    function mintSoulFor(
        address to,
        bytes32 dataHash,
        string calldata storeTxId,
        string calldata imageUri,
        string calldata soulSummary,
        string calldata soulStatement,
        string[] memory skills
    ) external payable onlyOwner returns (uint256) {
        if (_hasMinted[to]) revert AlreadyMinted();
        if (msg.value < mintPrice) revert InsufficientFee();

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _hasMinted[to] = true;

        _souls[tokenId] = SoulData({
            dataHash: dataHash,
            storeTxId: storeTxId,
            imageUri: imageUri,
            soulSummary: soulSummary,
            soulStatement: soulStatement,
            skills: skills,
            version: 1,
            lastUpdated: block.timestamp
        });

        _registerAgent(to, tokenId, soulSummary, imageUri);

        emit SoulMinted(tokenId, to, dataHash);
        return tokenId;
    }

    // ============ ERC-8004: Internal Registration ============

    function _registerAgent(address agentOwner, uint256 tokenId, string memory summary, string memory imageUri) internal {
        if (address(_agentRegistry) == address(0)) return; // skip if no registry

        string memory agentURI = string.concat(
            "data:application/json;base64,",
            Base64.encode(bytes(string.concat(
                '{"type":"https://eips.ethereum.org/EIPS/eip-8004#registration-v1",',
                '"name":"SoulClaw #', tokenId.toString(), '",',
                '"description":"', summary, '",',
                '"image":"', imageUri, '",',
                '"services":[{"name":"SoulClaw","endpoint":"https://engram-five.vercel.app/api"}],',
                '"x402Support":false,',
                '"active":true,',
                '"supportedTrust":["reputation","tee-attestation"]}'
            )))
        );

        uint256 agentId = _agentRegistry.registerFor(agentOwner, agentURI);
        _tokenToAgentId[tokenId] = agentId;
        _ownerToAgentId[agentOwner] = agentId;
        emit AgentRegistered(tokenId, agentId, agentOwner);
    }

    // ============ ERC-8004: Getters ============

    function agentRegistry() external view returns (address) {
        return address(_agentRegistry);
    }

    function setAgentRegistry(address newRegistry) external onlyOwner {
        _agentRegistry = AgentRegistry(newRegistry);
    }

    function getAgentId(uint256 tokenId) external view returns (uint256) {
        return _tokenToAgentId[tokenId];
    }

    function getAgentIdForOwner(address owner) external view returns (uint256) {
        return _ownerToAgentId[owner];
    }

    // ============ SoulClaw: Update ============

    function updateSoul(
        uint256 tokenId,
        bytes32 newDataHash,
        string calldata newStoreTxId,
        string calldata newImageUri,
        string calldata newSoulSummary,
        string calldata newSoulStatement
    ) external {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        _updateSoulInternal(tokenId, newDataHash, newStoreTxId, newImageUri, newSoulSummary, newSoulStatement);
    }

    /// @notice OPERATOR updates on behalf of user
    function updateSoulFor(
        address soulOwner,
        uint256 tokenId,
        bytes32 newDataHash,
        string calldata newStoreTxId,
        string calldata newImageUri,
        string calldata newSoulSummary,
        string calldata newSoulStatement
    ) external onlyOwner {
        if (ownerOf(tokenId) != soulOwner) revert NotTokenOwner();
        _updateSoulInternal(tokenId, newDataHash, newStoreTxId, newImageUri, newSoulSummary, newSoulStatement);
    }

    function _updateSoulInternal(
        uint256 tokenId,
        bytes32 newDataHash,
        string calldata newStoreTxId,
        string calldata newImageUri,
        string calldata newSoulSummary,
        string calldata newSoulStatement
    ) internal {
        SoulData storage soul = _souls[tokenId];
        bytes32 oldHash = soul.dataHash;

        soul.dataHash = newDataHash;
        soul.storeTxId = newStoreTxId;
        if (bytes(newImageUri).length > 0) soul.imageUri = newImageUri;
        if (bytes(newSoulSummary).length > 0) soul.soulSummary = newSoulSummary;
        if (bytes(newSoulStatement).length > 0) soul.soulStatement = newSoulStatement;
        soul.version++;
        soul.lastUpdated = block.timestamp;

        emit SoulUpdated(tokenId, oldHash, newDataHash, soul.version);
    }

    function updateSkills(uint256 tokenId, string[] memory newSkills) external {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        _souls[tokenId].skills = newSkills;
        _souls[tokenId].lastUpdated = block.timestamp;
        emit SkillsUpdated(tokenId, newSkills);
    }

    // ============ SoulClaw: Read ============

    function getSoulData(uint256 tokenId) external view returns (SoulData memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenNotExist();
        return _souls[tokenId];
    }

    function hasMinted(address account) external view returns (bool) {
        return _hasMinted[account];
    }

    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }

    // ============ Metadata ============

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenNotExist();
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

    // ============ ERC-165 ============

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC2981) returns (bool)
    {
        return
            interfaceId == type(IERC7857).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    // ============ Admin ============

    function setMintPrice(uint256 newPrice) external onlyOwner {
        mintPrice = newPrice;
    }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}
