// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";


/**
 * The token of the HashStrat DAO
 *
 * HashStrat DAO tokens has fixed supply which is all devolved to the Staking Pool to reward
 * providers of liquidity to HashStrat Pools and Indexex.
 *
 * Users that provide liquidity into HashStrat Pools and Indexex and stake their LP tokens
 * will earn HashStrat DAO tokens that allow to partecipate in the DAO governance and revenue share programs.
 *
 */

contract HashStratDAOToken is ERC20, ERC20Permit, ERC20Votes {

    uint private supply = 1_000_000 * 10 ** decimals();

    constructor() ERC20("HashStratDAOToken", "HST") ERC20Permit("HashStratDAOToken") {
        _mint(address(msg.sender), supply);
    }

    function _afterTokenTransfer(address from, address to, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._burn(account, amount);
    }
}