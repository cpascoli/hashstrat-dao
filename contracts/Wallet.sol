// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract Wallet is Ownable {

    event Deposited(address indexed user, address indexed lpTokenAddress, uint256 amount);
    event Withdrawn(address indexed user, address indexed lpTokenAddress, uint256 amount);

    // account_address -> (lp_token_address -> lp_token_balance)
    mapping(address => mapping(address => uint256) ) public balances;

    // the addresses of LP tokens of the HashStrat Pools and Indexes supported
    address[] internal lpTokensArray;
    mapping(address => bool) internal lpTokens;

    // users that deposited CakeLP tokens into their balances
    address[] internal usersArray;
    mapping(address => bool) internal users;


    //// Public View Functions ////
    function getBalance(address _userAddress, address _lpAddr) external view returns (uint256) {
        return balances[_userAddress][_lpAddr];
    }

    function getUsers() external view returns (address[] memory) {
        return usersArray;
    }

    function getLPTokens() external view returns (address[] memory) {
        return lpTokensArray;
    }


    //// Public Functions ////
    function deposit(address lpAddress, uint256 amount) public {
        require(amount > 0, "Deposit amount should not be 0");
        require(lpTokens[lpAddress] == true, "LP Token not supported");

        require(
            IERC20(lpAddress).allowance(msg.sender, address(this)) >= amount, "Insufficient allowance"
        );

        balances[msg.sender][lpAddress] += amount;

        // remember addresses that deposited LP tokens
        if (!users[msg.sender]) {
            users[msg.sender] = true;
            usersArray.push(msg.sender);
        }

        IERC20(lpAddress).transferFrom(msg.sender, address(this), amount);

        emit Deposited(msg.sender, lpAddress, amount);
    }


    function withdraw(address lpAddress, uint256 amount) public {
        require(lpTokens[lpAddress] == true, "LP Token not supported");
        require(balances[msg.sender][lpAddress] >= amount, "Insufficient token balance");

        balances[msg.sender][lpAddress] -= amount;
        IERC20(lpAddress).transfer(msg.sender, amount);

        emit Withdrawn(msg.sender, lpAddress, amount);
    }


    //// ONLY OWNER FUNCTIONALITY ////

    function addLPToken(address lpToken) external onlyOwner {
        if (lpTokens[lpToken] == false) {
            lpTokens[lpToken] = true;
            lpTokensArray.push(lpToken);
        }
    }

    function removeLPToken(address lpToken) external onlyOwner {
        if (lpTokens[lpToken] == true) {
            lpTokens[lpToken] = false;
        }
    }

}
