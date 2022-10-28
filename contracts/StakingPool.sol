// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract StakingPool is Ownable {

    event Staked(address indexed user, address indexed lpTokenAddresses, uint amount);
    event UnStaked(address indexed user, address indexed lpTokenAddresses, uint256 amount);
    event Deposited(address indexed user, address indexed lpTokenAddress, uint256 amount);
    event Withdrawn(address indexed user, address indexed lpTokenAddress, uint256 amount);


    // account_address -> (lp_token_address -> lp_token_balance)
    mapping(address => mapping(address => uint256) ) public balances;

    // the addresses of LP tokens of the HashStrat Pools and Indexes supported
    address[] private lpTokensArray;
    mapping(address => bool) internal enabledLPTokens;
    uint internal enabledLPTokenCount = 0;

    // users that deposited CakeLP tokens into their balances
    address[] private usersArray;
    mapping(address => bool) private existingUsers;


    // addresses that have active stakes
    address[] public stakers; 

    // account_address => (lp_token_address => stake_balance)
    mapping (address => mapping(address =>  uint)) public stakes;
 
    // constructor() Wallet() {}


    //// Public View Functions ////

    function getStakers() external view returns (address[] memory) {
        return stakers;
    }


    function getStakedBalance(address account, address lpToken) public view returns (uint) {
        if(enabledLPTokens[lpToken] == false) return 0;

        return stakes[account][lpToken];
    }


    function getBalance(address _userAddress, address _lpAddr) external view returns (uint256) {
        return balances[_userAddress][_lpAddr];
    }


    function getUsers() external view returns (address[] memory) {
        return usersArray;
    }


    // return the array of enabled LP tokens addresses
    function getLPTokens() public view returns (address[] memory) {
        address[] memory enabledTokens = new address[](enabledLPTokenCount);

        uint j = 0;
        for (uint i = 0; i<lpTokensArray.length; i++){
            address lpToken = lpTokensArray[i];
            if (enabledLPTokens[lpToken]) {
                enabledTokens[j] = lpToken;
                j++;
            }
        }

        return enabledTokens;
    }


    //// Public Functions ////

    function deposit(address lpAddress, uint256 amount) public {
        require(amount > 0, "Deposit amount should not be 0");
        require(enabledLPTokens[lpAddress] == true, "LP Token not supported");

        require(
            IERC20(lpAddress).allowance(msg.sender, address(this)) >= amount, "Insufficient allowance"
        );

        balances[msg.sender][lpAddress] += amount;

        // remember addresses that deposited LP tokens
        if (existingUsers[msg.sender] == false) {
            existingUsers[msg.sender] = true;
            usersArray.push(msg.sender);
        }

        IERC20(lpAddress).transferFrom(msg.sender, address(this), amount);

        emit Deposited(msg.sender, lpAddress, amount);
    }


    function withdraw(address lpAddress, uint256 amount) public {
        require(enabledLPTokens[lpAddress] == true, "LP Token not supported");
        require(balances[msg.sender][lpAddress] >= amount, "Insufficient token balance");

        balances[msg.sender][lpAddress] -= amount;
        IERC20(lpAddress).transfer(msg.sender, amount);

        emit Withdrawn(msg.sender, lpAddress, amount);
    }


    function startStake(address lpToken, uint amount) virtual public {
        require(enabledLPTokens[lpToken] == true, "LP Token not supported");
        require(amount > 0, "Stake must be a positive amount greater than 0");
        require(balances[msg.sender][lpToken] >= amount, "Not enough tokens to stake");

        // move tokens from lp token balance to the staked balance
        balances[msg.sender][lpToken] -= amount;
        stakes[msg.sender][lpToken] += amount;
       
        emit Staked(msg.sender, lpToken, amount);
    }


    function endStake(address lpToken, uint amount) virtual public {
        require(enabledLPTokens[lpToken] == true, "LP Token not supported");
        require(stakes[msg.sender][lpToken] >= amount, "Not enough tokens staked");

        // return lp tokens to lp token balance
        balances[msg.sender][lpToken] += amount;
        stakes[msg.sender][lpToken] -= amount; 

        emit UnStaked(msg.sender, lpToken, amount);
    }


    function depositAndStartStake(address lpToken, uint256 amount) public {
        deposit(lpToken, amount);
        startStake(lpToken, amount);
    }


    function endStakeAndWithdraw(address lpToken, uint amount) public {
        endStake(lpToken, amount);
        withdraw(lpToken, amount);
    }



    //// ONLY OWNER FUNCTIONALITY ////

    function addLPTokens(address[] memory lpTokenAddresses) external onlyOwner {

        for (uint i = 0; i<lpTokenAddresses.length; i++) {
            address lpToken = lpTokenAddresses[i];
            if (lpToken != address(0) && enabledLPTokens[lpToken] == false) {
                enabledLPTokens[lpToken] = true;
                lpTokensArray.push(lpToken);
                enabledLPTokenCount++;
            }
        }
    }


    function removeLPTokens(address[] memory lpTokenAddresses) external onlyOwner {
        for (uint i = 0; i<lpTokenAddresses.length; i++) {
            address lpToken = lpTokenAddresses[i];
            if (lpToken != address(0) && enabledLPTokens[lpToken] == true) {
                enabledLPTokens[lpToken] = false;
                enabledLPTokenCount--;
            }
        }
    }

}
