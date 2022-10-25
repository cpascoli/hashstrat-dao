// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IDivsDistributor {

    function canCreateNewDistributionInterval() external view returns (bool);
    function addDistributionInterval() external;
}