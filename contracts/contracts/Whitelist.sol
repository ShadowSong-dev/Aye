// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title Whitelist
/// @notice User-owned trusted address list. Only the owner can mutate.
///         The agent must never have write authority — it only reads.
contract Whitelist {
    address public owner;

    mapping(address => bool) private _whitelisted;
    address[] private _addresses;
    mapping(address => uint256) private _indexPlusOne;

    event AddressAdded(address indexed addr);
    event AddressRemoved(address indexed addr);
    event OwnerChanged(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error ZeroAddress();
    error AlreadyWhitelisted();
    error NotWhitelisted();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
    }

    function changeOwner(address addr) external onlyOwner {
        if (addr == address(0)) revert ZeroAddress();
        owner = addr;
        emit OwnerChanged(msg.sender, addr);
    }

    function addAddress(address addr) external onlyOwner {
        _add(addr);
    }

    function removeAddress(address addr) external onlyOwner {
        _remove(addr);
    }

    function addAddresses(address[] calldata addrs) external onlyOwner {
        for (uint256 i = 0; i < addrs.length; i++) {
            _add(addrs[i]);
        }
    }

    function removeAddresses(address[] calldata addrs) external onlyOwner {
        for (uint256 i = 0; i < addrs.length; i++) {
            _remove(addrs[i]);
        }
    }

    function _add(address addr) private {
        if (addr == address(0)) revert ZeroAddress();
        if (_whitelisted[addr]) revert AlreadyWhitelisted();
        
        _whitelisted[addr] = true;
        _addresses.push(addr);
        _indexPlusOne[addr] = _addresses.length;
        emit AddressAdded(addr);
    }

    function _remove(address addr) private {
        if (!_whitelisted[addr]) revert NotWhitelisted();
        _whitelisted[addr] = false;

        uint256 idx = _indexPlusOne[addr] - 1;
        uint256 lastIdx = _addresses.length - 1;
        if (idx != lastIdx) {
            address lastAddr = _addresses[lastIdx];
            _addresses[idx] = lastAddr;
            _indexPlusOne[lastAddr] = idx + 1;
        }
        _addresses.pop();
        delete _indexPlusOne[addr];

        emit AddressRemoved(addr);
    }

    function isWhitelisted(address addr) external view returns (bool) {
        return _whitelisted[addr];
    }

    function getAddresses() external view returns (address[] memory) {
        return _addresses;
    }

    function count() external view returns (uint256) {
        return _addresses.length;
    }
}
