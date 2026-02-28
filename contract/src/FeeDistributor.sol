// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

contract FeeDistributor is ReentrancyGuard, Ownable2Step {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error NothingToDistribute();

    IERC20 public immutable usdc;
    address public agentWallet;
    uint256 public totalCollected;
    uint256 public totalDistributed;

    event Distributed(uint256 amount, address indexed caller);
    event AgentWalletUpdated(address indexed oldAgent, address indexed newAgent);
    
    constructor(address usdc_, address agentWallet_) Ownable(msg.sender) {
        if (usdc_ == address(0)) revert ZeroAddress();
        if (agentWallet_ == address(0)) revert ZeroAddress();

        usdc = IERC20(usdc_);
        agentWallet = agentWallet_;
    }

    receive() external payable {
        revert("FeeDistributor: no ETH");
    }

    function distribute() external nonReentrant {
        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) revert NothingToDistribute();

        totalCollected += balance;
        totalDistributed += balance;

        emit Distributed(balance, msg.sender);

        usdc.safeTransfer(agentWallet, balance);
    }

    function setAgentWallet(address newAgent) external onlyOwner {
        if (newAgent == address(0)) revert ZeroAddress();

        address oldAgent = agentWallet;
        agentWallet = newAgent;

        emit AgentWalletUpdated(oldAgent, newAgent);
    }
}