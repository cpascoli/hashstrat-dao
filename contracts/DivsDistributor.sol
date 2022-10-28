    // SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./IPoolV3.sol";
import "./ITreasury.sol";

import "./IHashStratDAOToken.sol";
import "./IDivsDistributor.sol";


/**
 * This contract allows to distribute dividends to DAO token holders.
 *
 * The Owner of this contact should be DAOOperations that will be allow to
 * suspend or change the distribution periods.
 *
 */

contract DivsDistributor is Ownable, IDivsDistributor {

    event DistributionIntervalCreated(uint paymentIntervalId, uint dividendsAmount, uint blockFrom, uint blockTo);

    uint immutable MIN_BLOCKS_INTERVAL = 1 * 24 * 60 * 60 / 2; 
    uint immutable MAX_BLOCKS_INTERVAL = 90 * 24 * 60 * 60 / 2; 

    // Number of blocks for a payment interval
    uint public paymentInterval = 30 * 24 * 60 * 60 / 2; // 30 days (Polygon block time is ~ 2s)


    // The DAO token to distribute to stakers
    IHashStratDAOToken immutable public hstToken;
    IERC20Metadata immutable public feesToken;

    uint public totalDivsPaid;
    DistributionInterval[] public distributiontIntervals;
    

    struct DistributionInterval {
        uint id;
        uint reward;    // the divs to be distributed
        uint from;      // block number
        uint to;        // block number
        uint rewardsPaid;
    }

    // distribution_interval.id => ( account => claimed ) 
    mapping(uint => mapping(address => bool)) claimed;


    constructor(address feesTokenAddress, address hstTokenAddress) {
        feesToken = IERC20Metadata(feesTokenAddress);
        hstToken = IHashStratDAOToken(hstTokenAddress);
    }


    function getDistributionIntervals() public view returns (DistributionInterval[] memory) {
        return distributiontIntervals;
    }


    function getDistributiontIntervalsCount() public view returns (uint) {
        return distributiontIntervals.length;
    }


    function claimableDivs(address account) public view returns (uint divs) {

        if (distributiontIntervals.length == 0) return 0;

        DistributionInterval memory distribution = distributiontIntervals[distributiontIntervals.length - 1];

        if (distribution.from == block.number) return 0;

        if (claimedDivs(distribution.id, account) == false) {
            uint tokens = hstToken.getPastVotes(account, distribution.from);
            uint totalSupply = hstToken.getPastTotalSupply(distribution.from);

            divs = totalSupply > 0 ? distribution.reward * tokens / totalSupply : 0;
        }
    }

    function claimedDivs(uint distributionId, address account) public view returns (bool) {
        return claimed[distributionId][account];
    }


    // claim divs
    function claimDivs() public {
        uint divs = claimableDivs(msg.sender);
        if (divs > 0) {
            DistributionInterval storage distribution = distributiontIntervals[distributiontIntervals.length - 1];
            claimed[distribution.id][msg.sender] = true;
            distribution.rewardsPaid += divs;
            totalDivsPaid += divs;

            feesToken.transfer(msg.sender, divs);
        }
    }

    ///// IDivsDistributor
    
    function canCreateNewDistributionInterval() public view returns (bool) {
        return feesToken.balanceOf(address(this)) > 0 &&
                (distributiontIntervals.length == 0 || block.number > distributiontIntervals[distributiontIntervals.length-1].to);
    }


    // Add a new reward period.
    // Requires to be called after the previous period ended and requires positive 'feesToken' balance
    function addDistributionInterval() external {
        require(canCreateNewDistributionInterval(), "Cannot create distribution interval");

        uint from = distributiontIntervals.length == 0 ? block.number : distributiontIntervals[distributiontIntervals.length-1].to + 1;
        uint to = block.number + paymentInterval;

        // determine the reward amount
        uint reward = feesToken.balanceOf(address(this));
        require(reward > 0, "Invalid reward amount");
   
        distributiontIntervals.push(DistributionInterval(distributiontIntervals.length+1, reward, from, to, 0));

        emit DistributionIntervalCreated(distributiontIntervals.length, reward, from, to);
    }


    //// OnlyOwner functionality
    function updatePaymentInterval(uint blocks) public onlyOwner {
        require (blocks >= MIN_BLOCKS_INTERVAL && blocks <= MAX_BLOCKS_INTERVAL, "Invalid payment interval");
        paymentInterval = blocks;
    }

}