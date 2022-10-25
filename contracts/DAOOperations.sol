// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";

import "./IPoolV3.sol";
import "./ITreasury.sol";
import "./IDivsDistributor.sol";

import "hardhat/console.sol";


/**
 * This contract implements the DAO functions executable via DAO proposals.
 *
 * The Owner of this contact should be HashStratTimelockController
 * that will be the executor of all voted proposals.
 */

contract DAOOperations is Ownable, AutomationCompatibleInterface {


    // the addresses of LP tokens of the HashStrat Pools and Indexes supported
    address[] poolsArray;
    mapping(address => bool) enabledPools;
    uint enabledPoolsCount;

    IERC20Metadata public feesToken;
    ITreasury public treasury;
    IDivsDistributor public divsDistributor;

    uint public totalFeesCollected;
    uint public totalFeesTransferred;

    uint public immutable percPrecision = 4;

    uint public divsPerc = 1000; // 100% of fees distributed as divs


    constructor(address feesTokenAddress, address treasuryAddress, address divsDistributorAddress) {
        treasury = ITreasury(treasuryAddress);
        feesToken = IERC20Metadata(feesTokenAddress);
        divsDistributor = IDivsDistributor(divsDistributorAddress);
    }


    //// Public View function ////

    //// Pools Management ////
    function getPools() external view returns (address[] memory) {
        return poolsArray;
    }


    function getEnabledPools() external view returns (address[] memory) {
        address[] memory enabled = new address[] (enabledPoolsCount);
        uint count = 0;

        for (uint i = 0; i < poolsArray.length; i++) {
            address poolAddress = poolsArray[i];
            if (enabledPools[poolAddress] == true) {
                enabled[count] = poolAddress;
                count++;
            }
        }

        return poolsArray;
    }


    function addPools(address[] memory poolAddresses) external onlyOwner {

        for (uint i = 0; i<poolAddresses.length; i++) {
            address poolAddress = poolAddresses[i];
            if (enabledPools[poolAddress] == false) {
                enabledPools[poolAddress] = true;
                poolsArray.push(poolAddress);
                treasury.addPool(poolAddress);
                enabledPoolsCount++;
            }
        }
    }


    function removePools(address[] memory poolAddresses) external onlyOwner {
        for (uint i = 0; i<poolAddresses.length; i++) {
            address poolAddress = poolAddresses[i];
            if (enabledPools[poolAddress] == true) {
                enabledPools[poolAddress] = false;
                treasury.removePool(poolAddress);
                enabledPoolsCount--;
            }
        }
    }


    // Public functions

    // Collect fees from all Pools and transfer them to the Treasury
    function collectFees() public {
        for (uint i = 0; i < poolsArray.length; i++) {
            if (enabledPools[poolsArray[i]]) {
                IPoolV3 pool = IPoolV3(poolsArray[i]);
                uint before = feesToken.balanceOf(address(this));
                pool.collectFees(0); // withdraw fees from pool to this contract
                uint collectedAmount = feesToken.balanceOf(address(this)) - before;
                if (collectedAmount > 0) {
                    feesToken.transfer(address(treasury), collectedAmount);
                }
            }
        }
    }


    //// DAO operations

    function transferFunds(address to, uint amount) external onlyOwner {
        require (amount <= feesToken.balanceOf(address(treasury)) , "Excessive amount");
        if (amount > 0) {
            totalFeesTransferred += amount;
            treasury.transferFunds(to, amount);
        }
    }


    function setDivsPerc(uint divsPercentage) external onlyOwner {
        require(divsPercentage >= 0 && divsPercentage <= (10 ** percPrecision), "invalid percentage");
        
        divsPerc = divsPercentage;
    }


    function setFeesPerc(address poolAddress, uint feesPerc) external onlyOwner {
        IPoolV3(poolAddress).setFeesPerc(feesPerc);
    }


    function setSlippageThereshold(address poolAddress, uint slippage) external onlyOwner {
        IPoolV3(poolAddress).setSlippageThereshold(slippage);
    }


    function setStrategy(address poolAddress, address strategyAddress) external onlyOwner {
        IPoolV3(poolAddress).setStrategy(strategyAddress);
    }


    function setUpkeepInterval(address poolAddress, uint upkeepInterval) external onlyOwner {
        IPoolV3(poolAddress).setUpkeepInterval(upkeepInterval);
    }


    //// AutomationCompatible
    function checkUpkeep(bytes calldata /* checkData */) external view override returns (bool upkeepNeeded, bytes memory performData) {
        upkeepNeeded = divsDistributor.canCreateNewDistributionInterval();
    }


    // Transfer new fees from Pools to Treasury and create a new distribution interval
    function performUpkeep(bytes calldata /* performData */) external override {
        
        if ( divsDistributor.canCreateNewDistributionInterval() ) {
            
            // transfer new fees from pools to the Treasury
            collectFees();
            uint trasuryBalance = feesToken.balanceOf(address(treasury));

            uint feesToDistribute = trasuryBalance * divsPerc / 10 ** percPrecision;
            if (feesToDistribute > 0) {
                treasury.transferFunds(address(divsDistributor), feesToDistribute);
            }
            // if there re divs to distribute, create a new distribution interval
            if (feesToken.balanceOf(address(divsDistributor)) > 0) {
                divsDistributor.addDistributionInterval();
            }
        }
    }

}
