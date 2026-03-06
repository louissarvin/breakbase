// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {FeeDistributor} from "../src/FeeDistributor.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/// @title FeeDistributorTest
/// @notice Tests for FeeDistributor.sol. The distributor sends 100% of protocol
///         fees to the Agent Wallet. The agent decides treasury allocation.
contract FeeDistributorTest is Test {
    // -------------------------------------------------------------------------
    // Accounts
    // -------------------------------------------------------------------------
    address public owner;
    address public agentWallet;
    address public nonOwner;

    // -------------------------------------------------------------------------
    // Contracts
    // -------------------------------------------------------------------------
    MockERC20 public usdc;
    FeeDistributor public distributor;

    // -------------------------------------------------------------------------
    // Setup
    // -------------------------------------------------------------------------

    function setUp() public {
        owner = address(this);
        agentWallet = makeAddr("agentWallet");
        nonOwner = makeAddr("nonOwner");

        usdc = new MockERC20("USD Coin", "USDC", 6);
        distributor = new FeeDistributor(address(usdc), agentWallet);
    }

    // =========================================================================
    // Constructor
    // =========================================================================

    function test_constructor_setsState() public view {
        assertEq(address(distributor.usdc()), address(usdc));
        assertEq(distributor.agentWallet(), agentWallet);
        assertEq(distributor.owner(), owner);
    }

    function test_constructor_reverts_zeroUsdc() public {
        vm.expectRevert(FeeDistributor.ZeroAddress.selector);
        new FeeDistributor(address(0), agentWallet);
    }

    function test_constructor_reverts_zeroAgent() public {
        vm.expectRevert(FeeDistributor.ZeroAddress.selector);
        new FeeDistributor(address(usdc), address(0));
    }

    // =========================================================================
    // distribute
    // =========================================================================

    function test_distribute_sendsAllToAgent() public {
        uint256 balance = 10_000_000; // $10.00
        usdc.mint(address(distributor), balance);

        distributor.distribute();

        assertEq(usdc.balanceOf(agentWallet), balance, "agent gets 100%");
        assertEq(usdc.balanceOf(address(distributor)), 0, "distributor emptied");
    }

    function test_distribute_smallAmount() public {
        usdc.mint(address(distributor), 1); // 1 unit
        distributor.distribute();
        assertEq(usdc.balanceOf(agentWallet), 1, "agent gets even 1 unit");
    }

    function test_distribute_reverts_whenEmpty() public {
        vm.expectRevert(FeeDistributor.NothingToDistribute.selector);
        distributor.distribute();
    }

    function test_distribute_permissionless() public {
        usdc.mint(address(distributor), 1_000_000);

        vm.prank(nonOwner);
        distributor.distribute();

        assertEq(usdc.balanceOf(agentWallet), 1_000_000, "agent received funds");
    }

    function test_distribute_updatesCounters() public {
        uint256 balance = 5_000_000;
        usdc.mint(address(distributor), balance);

        assertEq(distributor.totalCollected(), 0);
        assertEq(distributor.totalDistributed(), 0);

        distributor.distribute();

        assertEq(distributor.totalCollected(), balance);
        assertEq(distributor.totalDistributed(), balance);
    }

    function test_distribute_multipleRounds() public {
        // Round 1
        usdc.mint(address(distributor), 1_000_000);
        distributor.distribute();

        // Round 2
        usdc.mint(address(distributor), 2_000_000);
        distributor.distribute();

        assertEq(distributor.totalCollected(), 3_000_000);
        assertEq(distributor.totalDistributed(), 3_000_000);
        assertEq(usdc.balanceOf(agentWallet), 3_000_000, "agent got all rounds");
    }

    function test_distribute_emitsEvent() public {
        uint256 balance = 1_000_000;
        usdc.mint(address(distributor), balance);

        vm.expectEmit(true, false, false, true);
        emit FeeDistributor.Distributed(balance, address(this));

        distributor.distribute();
    }

    // =========================================================================
    // setAgentWallet
    // =========================================================================

    function test_setAgentWallet_updates() public {
        address newAgent = makeAddr("newAgent");
        distributor.setAgentWallet(newAgent);
        assertEq(distributor.agentWallet(), newAgent);
    }

    function test_setAgentWallet_reverts_zero() public {
        vm.expectRevert(FeeDistributor.ZeroAddress.selector);
        distributor.setAgentWallet(address(0));
    }

    function test_setAgentWallet_onlyOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        distributor.setAgentWallet(makeAddr("newAgent"));
    }

    function test_setAgentWallet_emitsEvent() public {
        address newAgent = makeAddr("newAgent");

        vm.expectEmit(true, true, false, false);
        emit FeeDistributor.AgentWalletUpdated(agentWallet, newAgent);

        distributor.setAgentWallet(newAgent);
    }

    function test_setAgentWallet_affectsNextDistribute() public {
        address newAgent = makeAddr("newAgent");
        usdc.mint(address(distributor), 1_000_000);

        distributor.setAgentWallet(newAgent);
        distributor.distribute();

        assertEq(usdc.balanceOf(newAgent), 1_000_000, "new agent gets funds");
        assertEq(usdc.balanceOf(agentWallet), 0, "old agent gets nothing");
    }

    // =========================================================================
    // receive (ETH rejection)
    // =========================================================================

    function test_receive_rejectsETH() public {
        vm.deal(nonOwner, 1 ether);

        vm.prank(nonOwner);
        (bool ok,) = address(distributor).call{value: 1 ether}("");
        assertFalse(ok, "ETH transfer should fail");
    }

    function test_receive_rejectsETH_withData() public {
        vm.deal(nonOwner, 1 ether);

        vm.prank(nonOwner);
        (bool ok,) = address(distributor).call{value: 1 ether}(hex"deadbeef");
        assertFalse(ok, "ETH transfer with data should fail");
    }
}
