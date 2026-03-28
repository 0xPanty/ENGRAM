// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./interfaces/IReputationRegistry.sol";

/// @title ReputationRegistry - ERC-8004 Reputation Registry
/// @notice Stores feedback signals for registered agents.
contract ReputationRegistry is IReputationRegistry {
    address public immutable identityRegistry;

    struct FeedbackEntry {
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
        bool isRevoked;
    }

    mapping(uint256 => mapping(address => mapping(uint64 => FeedbackEntry))) private _feedbacks;
    mapping(uint256 => mapping(address => uint64)) private _lastIndex;
    mapping(uint256 => address[]) private _clients;
    mapping(uint256 => mapping(address => bool)) private _isClient;

    error AgentNotExist();
    error SelfFeedback();
    error InvalidDecimals();
    error FeedbackNotExist();

    constructor(address _identityRegistry) {
        identityRegistry = _identityRegistry;
    }

    function getIdentityRegistry() external view returns (address) {
        return identityRegistry;
    }

    // ============ Give Feedback ============

    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external {
        _requireAgentExists(agentId);
        if (valueDecimals > 18) revert InvalidDecimals();

        address agentOwner = IERC721(identityRegistry).ownerOf(agentId);
        if (msg.sender == agentOwner) revert SelfFeedback();

        if (!_isClient[agentId][msg.sender]) {
            _clients[agentId].push(msg.sender);
            _isClient[agentId][msg.sender] = true;
        }

        uint64 idx = ++_lastIndex[agentId][msg.sender];

        FeedbackEntry storage fb = _feedbacks[agentId][msg.sender][idx];
        fb.value = value;
        fb.valueDecimals = valueDecimals;
        fb.tag1 = tag1;
        fb.tag2 = tag2;

        emit NewFeedback(agentId, msg.sender, idx, value, valueDecimals, tag1, tag1, tag2, endpoint, feedbackURI, feedbackHash);
    }

    // ============ Revoke ============

    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external {
        if (feedbackIndex == 0 || feedbackIndex > _lastIndex[agentId][msg.sender]) revert FeedbackNotExist();
        _feedbacks[agentId][msg.sender][feedbackIndex].isRevoked = true;
        emit FeedbackRevoked(agentId, msg.sender, feedbackIndex);
    }

    // ============ Append Response ============

    function appendResponse(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex,
        string calldata responseURI,
        bytes32 responseHash,
        string calldata tag
    ) external {
        if (feedbackIndex == 0 || feedbackIndex > _lastIndex[agentId][clientAddress]) revert FeedbackNotExist();
        emit ResponseAppended(agentId, clientAddress, feedbackIndex, msg.sender, responseURI, responseHash);
    }

    // ============ Read ============

    function readFeedback(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex
    ) external view returns (int128 value, uint8 valueDecimals, string memory tag1, string memory tag2, bool isRevoked) {
        FeedbackEntry storage fb = _feedbacks[agentId][clientAddress][feedbackIndex];
        return (fb.value, fb.valueDecimals, fb.tag1, fb.tag2, fb.isRevoked);
    }

    function getClients(uint256 agentId) external view returns (address[] memory) {
        return _clients[agentId];
    }

    function getLastIndex(uint256 agentId, address clientAddress) external view returns (uint64) {
        return _lastIndex[agentId][clientAddress];
    }

    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses
    ) external view returns (uint64 count, int128 avgValue) {
        int256 total;
        for (uint i = 0; i < clientAddresses.length; i++) {
            uint64 last = _lastIndex[agentId][clientAddresses[i]];
            for (uint64 j = 1; j <= last; j++) {
                FeedbackEntry storage fb = _feedbacks[agentId][clientAddresses[i]][j];
                if (!fb.isRevoked) {
                    total += int256(fb.value);
                    count++;
                }
            }
        }
        if (count > 0) {
            avgValue = int128(total / int256(uint256(count)));
        }
    }

    // ============ Internal ============

    function _requireAgentExists(uint256 agentId) internal view {
        try IERC721(identityRegistry).ownerOf(agentId) returns (address) {
        } catch {
            revert AgentNotExist();
        }
    }
}
