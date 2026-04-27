// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IWhitelist {
    function owner() external view returns (address);
    function isWhitelisted(address addr) external view returns (bool);
}
