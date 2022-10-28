// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "./ITreasury.sol";
import "./IPoolV3.sol";


/**
 * The DAO Treasury holds the funds collected from the Pools.
 * Owner of this contract should be DAOOperations to transfer funds to DivsDistributor
 *
*/

contract Treasury is ITreasury, Ownable {

    IERC20Metadata public feesToken;

    constructor(address feesTokenAddress) {
        feesToken = IERC20Metadata(feesTokenAddress);
    }

    function getBalance() external view returns (uint) {
        return feesToken.balanceOf(address(this));
    }

    // used by DAOOperations to transfer divs to the
    function transferFunds(address to, uint amount) external onlyOwner {
        feesToken.transfer(to, amount);
    }

}