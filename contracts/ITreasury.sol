// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

interface ITreasury {

    function getBalance() external view returns (uint);
    function transferFunds(address to, uint amount) external;
}