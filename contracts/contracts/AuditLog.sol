// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { Whitelist } from "./Whitelist.sol";

/// @title AuditLog
/// @notice Append-only log of agent actions that the user has approved.
///         Each entry must carry an EIP-712 signature from the Whitelist owner;
///         no admin, no pause, no upgrade — once deployed it is immutable.
///         Inherits Whitelist so this contract is the single user-facing entry point.
contract AuditLog is Whitelist, EIP712 {
    using ECDSA for bytes32;

    bytes32 public constant INTENT_TYPEHASH =
        keccak256("TxIntent(string agentId,bytes32 intentHash,uint8 riskLevel,uint256 nonce,uint256 deadline)");

    struct Entry {
        string agentId;
        bytes32 intentHash;
        uint8 riskLevel;
        uint256 nonce;
        uint256 timestamp;
        address approver;
        bytes approvalSig;
    }

    Entry[] private _entries;
    mapping(uint256 => bool) public usedNonce;

    event Logged(
        uint256 indexed index,
        string agentId,
        bytes32 indexed intentHash,
        uint8 riskLevel,
        uint256 nonce,
        address indexed approver
    );

    error NonceUsed();
    error DeadlineExpired();
    error InvalidSignature();

    constructor(address initialOwner)
        Whitelist(initialOwner)
        EIP712("ElizaAuditLog", "1")
    {
        
    }

    /// @notice Records an agent action that has been pre-approved by the owner via an off-chain EIP-712 signature.
    /// @param agentId    Human-readable identifier of the agent performing the action (e.g. "eliza-trader-01").
    ///                   Hashed into the EIP-712 struct, so any change invalidates the signature.
    /// @param intentHash Hash committing to the full action payload (target, calldata, value, etc.).
    ///                   The contract does not interpret it — it only binds the signature to the intent.
    /// @param riskLevel  Caller-defined risk tier for the action. Stored verbatim for off-chain auditing;
    ///                   not enforced on-chain.
    /// @param nonce      Unique identifier for this approval. Once consumed it can never be reused,
    ///                   preventing replay of the same signed authorization.
    /// @param deadline   Unix timestamp after which the signature is no longer accepted.
    /// @param approvalSig 65-byte ECDSA signature (r,s,v) over the EIP-712 digest of
    ///                   (agentId, intentHash, riskLevel, nonce, deadline). Must be signed by `owner`.
    ///                   Stored in the entry for later off-chain re-verification.
    function log(
        string calldata agentId,
        bytes32 intentHash,
        uint8 riskLevel,
        uint256 nonce,
        uint256 deadline,
        bytes calldata approvalSig
    ) external {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (usedNonce[nonce]) revert NonceUsed();
        usedNonce[nonce] = true;

        bytes32 structHash = keccak256(
            abi.encode(
                INTENT_TYPEHASH,
                keccak256(bytes(agentId)),
                intentHash,
                riskLevel,
                nonce,
                deadline
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(approvalSig);
        if (signer != owner) revert InvalidSignature();

        _entries.push(
            Entry({
                agentId: agentId,
                intentHash: intentHash,
                riskLevel: riskLevel,
                nonce: nonce,
                timestamp: block.timestamp,
                approver: signer,
                approvalSig: approvalSig
            })
        );

        emit Logged(_entries.length - 1, agentId, intentHash, riskLevel, nonce, signer);
    }

    function entriesCount() external view returns (uint256) {
        return _entries.length;
    }

    function entryAt(uint256 i) external view returns (Entry memory) {
        return _entries[i];
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
