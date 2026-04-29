// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { AuditLog } from "./AuditLog.sol";

/// @title AuditLogFactory
/// @notice Deployer for per-user AuditLog instances.
///         Each owner address may have at most one AuditLog ever deployed by this factory.
contract AuditLogFactory {
    mapping(address => address) public deployedFor;

    event AuditLogDeployed(address indexed owner, address indexed auditLog);

    error ZeroAddress();
    error AlreadyDeployed(address existing);

    /// @notice Deploys a new AuditLog owned by `owner`.
    function deploy(address owner) external returns (address auditLog) {
        if (owner == address(0)) revert ZeroAddress();
        address existing = deployedFor[owner];
        if (existing != address(0)) revert AlreadyDeployed(existing);

        auditLog = address(new AuditLog(owner));

        deployedFor[owner] = auditLog;

        emit AuditLogDeployed(owner, auditLog);
    }

}