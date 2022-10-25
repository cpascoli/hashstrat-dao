// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IHashStratDAOToken is IERC20Metadata {

    function maxSupply() external view returns (uint);
    function mint(address to, uint256 amount) external;
    function getPastVotes(address account, uint256 blockNumber) external view  returns (uint256);
    function getPastTotalSupply(uint256 blockNumber) external view returns (uint256);
}