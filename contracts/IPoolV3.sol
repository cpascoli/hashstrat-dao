// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IPoolV3 {

    function lpToken() external view returns (IERC20Metadata);
    function totalValue() external view returns(uint);
    function riskAssetValue() external view returns(uint);
    function stableAssetValue() external view returns(uint);
    function portfolioValue(address addr) external view returns (uint);

    function collectFees(uint amount) external;
    function withdrawLP(uint amount) external;
    function withdrawAll() external;

    function setFeesPerc(uint feesPerc) external;
    function setSlippageThereshold(uint slippage) external;
    function setStrategy(address strategyAddress) external;
    function setUpkeepInterval(uint upkeepInterval) external;

    function feesForWithdraw(uint lpToWithdraw, address account) external view returns (uint);
    function gainsPerc(address account) external view returns (uint);

    function deposit(uint amount) external;

}