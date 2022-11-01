// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

interface IHashStratDAOTokenFarm {

    function addPools(address[] memory poolsAddresses) external;
    function removePools(address[] memory poolsAddresses) external;
}
