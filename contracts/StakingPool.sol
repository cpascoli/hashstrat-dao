// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;
pragma abicoder v2;

import "./Wallet.sol";


contract StakingPool is Wallet  {

    event Staked(address indexed user, address indexed lpTokenAddresses, uint amount);
    event UnStaked(address indexed user, address indexed lpTokenAddresses, uint256 amount);

    // addresses that have active stakes
    address[] public stakers; 

    // account_address => (lp_token_address => stake_balance)
    mapping (address => mapping(address =>  uint)) public stakes;
    uint public totalStakes;
 
    constructor() Wallet() {}


    //// Public View Functions ////

    function getStakers() external view returns (address[] memory) {
        return stakers;
    }

    function getStakedBalance(address account, address lpToken) public view returns (uint) {
        require(lpTokens[lpToken] == true, "LP Token not supported");
        return stakes[account][lpToken];
    }


    //// Public Functions ////

    function depositAndStartStake(address lpToken, uint256 amount) public {
        deposit(lpToken, amount);
        startStake(lpToken, amount);
    }


    function endStakeAndWithdraw(address lpToken, uint amount) public {
        endStake(lpToken, amount);
        withdraw(lpToken, amount);
    }


    function startStake(address lpToken, uint amount) virtual public {
        require(lpTokens[lpToken] == true, "LP Token not supported");
        require(amount > 0, "Stake must be a positive amount greater than 0");
        require(balances[msg.sender][lpToken] >= amount, "Not enough tokens to stake");

        // move tokens from lp token balance to the staked balance
        balances[msg.sender][lpToken] -= amount;
        stakes[msg.sender][lpToken] += amount;
       
        totalStakes += amount;

        emit Staked(msg.sender, lpToken, amount);
    }


    function endStake(address lpToken, uint amount) virtual public {
        require(lpTokens[lpToken] == true, "LP Token not supported");
        require(stakes[msg.sender][lpToken] >= amount, "Not enough tokens staked");

        // return lp tokens to lp token balance
        balances[msg.sender][lpToken] += amount;
        stakes[msg.sender][lpToken] -= amount; 

        totalStakes -= amount;

        emit UnStaked(msg.sender, lpToken, amount);
    }

}
