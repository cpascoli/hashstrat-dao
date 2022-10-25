// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "hardhat/console.sol";
import "./ITreasury.sol";
import "./IPoolV3.sol";

/**
 * The DAO Treasury holds the funds collected from the Pools.
 * Owner of this contract should be DAOOperations to transfer funds to DivsDistributor
 *
*/

contract Treasury is ITreasury, Ownable {

    IERC20Metadata public feesToken;
    address[] public poolsArray;
    mapping(address => bool) public enabledPools;


    constructor(address feesTokenAddress) {
        feesToken = IERC20Metadata(feesTokenAddress);
    }


    function getPools() external view returns (address[] memory) {
        return poolsArray;
    }

    function getBalance() external view returns (uint) {
        return feesToken.balanceOf(address(this));
    }


    // Returns the value of the LP token fees held in the pools
    function collectableFees() public view returns (uint) {
        uint total = 0;
        for (uint i = 0; i < poolsArray.length; i++) {
            if (enabledPools[poolsArray[i]]) {
                IPoolV3 pool = IPoolV3(poolsArray[i]);
                uint feeValue = pool.portfolioValue(address(pool));
                total += feeValue;
            }
        }

        return total;
    }


    // Transfer all fees to the Trasury
    function collectFees() external {
        for (uint i = 0; i < poolsArray.length; i++) {
            if (enabledPools[poolsArray[i]]) {
                IPoolV3 pool = IPoolV3(poolsArray[i]);
                uint lpbalance = pool.lpToken().balanceOf(address(pool));
                if (lpbalance > 0) {
                    pool.collectFees(lpbalance);
                }
            }
        }
    }



    /// OnlyOwner functions callable by DAOOperations

    function addPool(address poolAddress) external onlyOwner {
        if (enabledPools[poolAddress] == false) {
            enabledPools[poolAddress] = true;
            poolsArray.push(poolAddress);
        }
    }

    function removePool(address poolAddress) external onlyOwner {
        if (enabledPools[poolAddress] == true) {
            enabledPools[poolAddress] = false;
        }
    }

    // used by DAOOperations to transfer divs to the
    function transferFunds(address to, uint amount) external onlyOwner {
        feesToken.transfer(to, amount);
    }

}