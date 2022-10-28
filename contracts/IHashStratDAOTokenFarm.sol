// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

interface IHashStratDAOTokenFarm {

    function addLPTokens(address[] memory lpTokenAddresses) external;
    function removeLPTokens(address[] memory lpTokenAddresses) external;
}
