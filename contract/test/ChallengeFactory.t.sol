// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, Vm} from "forge-std/Test.sol";
import {Challenge} from "../src/Challenge.sol";
import {ChallengeFactory} from "../src/ChallengeFactory.sol";
import {IBreakBase} from "../src/interfaces/IBreakBase.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockEAS} from "./mocks/MockEAS.sol";

/// @title ChallengeFactoryTest
/// @notice Tests for ChallengeFactory.sol covering clone deployment, config validation,
///         admin functions, and access control.
contract ChallengeFactoryTest is Test {
    // -------------------------------------------------------------------------
    // Accounts
    // -------------------------------------------------------------------------
    address public owner;
    address public defenderAddr;
    address public oracleAddr;
    address public protocolWallet;
    address public nonOwner;

    // -------------------------------------------------------------------------
    // Contracts
    // -------------------------------------------------------------------------
    MockERC20 public usdc;
    Challenge public implementation;
    ChallengeFactory public factory;

    // -------------------------------------------------------------------------
    // Setup
    // -------------------------------------------------------------------------

    function setUp() public {
        owner = address(this);
        defenderAddr = makeAddr("defender");
        oracleAddr = makeAddr("oracle");
        protocolWallet = makeAddr("protocolWallet");
        nonOwner = makeAddr("nonOwner");

        usdc = new MockERC20("USD Coin", "USDC", 6);
        implementation = new Challenge();

        factory = new ChallengeFactory(address(implementation), protocolWallet, oracleAddr, address(usdc), address(0));
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _defaultConfig() internal view returns (IBreakBase.ChallengeConfig memory) {
        return IBreakBase.ChallengeConfig({
            defender: defenderAddr,
            usdc: address(usdc),
            basePrice: 1_000_000,
            maxFee: 0,
            duration: 7 days,
            growthRateBps: 0,
            pricingModel: IBreakBase.PricingModel.Fixed
        });
    }

    // =========================================================================
    // Constructor
    // =========================================================================

    function test_constructor_setsState() public view {
        assertEq(factory.implementation(), address(implementation));
        assertEq(factory.protocolWallet(), protocolWallet);
        assertEq(factory.oracle(), oracleAddr);
        assertEq(factory.usdc(), address(usdc));
        assertEq(factory.minBasePrice(), factory.DEFAULT_MIN_BASE_PRICE());
        assertEq(factory.maxDuration(), factory.DEFAULT_MAX_DURATION());
        assertEq(factory.owner(), owner);
    }

    function test_constructor_reverts_zeroImplementation() public {
        vm.expectRevert(IBreakBase.ZeroAddress.selector);
        new ChallengeFactory(address(0), protocolWallet, oracleAddr, address(usdc), address(0));
    }

    function test_constructor_reverts_zeroProtocolWallet() public {
        vm.expectRevert(IBreakBase.ZeroAddress.selector);
        new ChallengeFactory(address(implementation), address(0), oracleAddr, address(usdc), address(0));
    }

    function test_constructor_reverts_zeroOracle() public {
        vm.expectRevert(IBreakBase.ZeroAddress.selector);
        new ChallengeFactory(address(implementation), protocolWallet, address(0), address(usdc), address(0));
    }

    function test_constructor_reverts_zeroUsdc() public {
        vm.expectRevert(IBreakBase.ZeroAddress.selector);
        new ChallengeFactory(address(implementation), protocolWallet, oracleAddr, address(0), address(0));
    }

    // =========================================================================
    // createChallenge
    // =========================================================================

    function test_createChallenge_deploysClone() public {
        IBreakBase.ChallengeConfig memory config = _defaultConfig();

        vm.prank(defenderAddr);
        (address clone, bytes32 challengeId) = factory.createChallenge(config, 0);

        assertTrue(clone != address(0), "clone deployed");
        assertTrue(challengeId != bytes32(0), "challengeId nonzero");
        assertEq(factory.challenges(challengeId), clone, "stored in mapping");
    }

    function test_createChallenge_initializesCorrectly() public {
        IBreakBase.ChallengeConfig memory config = _defaultConfig();

        vm.prank(defenderAddr);
        (address clone,) = factory.createChallenge(config, 0);

        Challenge c = Challenge(clone);
        assertEq(c.defender(), defenderAddr);
        assertEq(address(c.usdc()), address(usdc));
        assertEq(c.basePrice(), config.basePrice);
        assertEq(c.oracle(), oracleAddr);
        assertEq(c.protocolWallet(), protocolWallet);
        assertEq(uint8(c.status()), uint8(IBreakBase.ChallengeStatus.Active));
    }

    function test_createChallenge_reverts_belowMinPrice() public {
        IBreakBase.ChallengeConfig memory config = _defaultConfig();
        config.basePrice = factory.minBasePrice() - 1;

        vm.prank(defenderAddr);
        vm.expectRevert(IBreakBase.BasePriceTooLow.selector);
        factory.createChallenge(config, 0);
    }

    function test_createChallenge_reverts_exceedsMaxDuration() public {
        IBreakBase.ChallengeConfig memory config = _defaultConfig();
        config.duration = uint48(factory.maxDuration() + 1);

        vm.prank(defenderAddr);
        vm.expectRevert(IBreakBase.DurationTooLong.selector);
        factory.createChallenge(config, 0);
    }

    function test_createChallenge_reverts_zeroDuration() public {
        IBreakBase.ChallengeConfig memory config = _defaultConfig();
        config.duration = 0;

        vm.prank(defenderAddr);
        vm.expectRevert(IBreakBase.InvalidDuration.selector);
        factory.createChallenge(config, 0);
    }

    function test_createChallenge_reverts_wrongUsdc() public {
        MockERC20 fakeUsdc = new MockERC20("Fake", "FAKE", 6);
        IBreakBase.ChallengeConfig memory config = _defaultConfig();
        config.usdc = address(fakeUsdc);

        vm.prank(defenderAddr);
        vm.expectRevert(IBreakBase.ZeroAddress.selector);
        factory.createChallenge(config, 0);
    }

    function test_createChallenge_reverts_nonDefenderCaller() public {
        IBreakBase.ChallengeConfig memory config = _defaultConfig();

        // nonOwner tries to create with defenderAddr in config
        vm.prank(nonOwner);
        vm.expectRevert(IBreakBase.OnlyDefender.selector);
        factory.createChallenge(config, 0);
    }

    // =========================================================================
    // createProtocolChallenge
    // =========================================================================

    function test_createProtocolChallenge_onlyOwner() public {
        IBreakBase.ChallengeConfig memory config = _defaultConfig();

        // Owner can create with any defender
        (address clone,) = factory.createProtocolChallenge(config, 0);
        assertTrue(clone != address(0), "owner creates protocol challenge");

        // Non-owner cannot
        vm.prank(nonOwner);
        vm.expectRevert();
        factory.createProtocolChallenge(config, 0);
    }

    function test_createProtocolChallenge_anyDefender() public {
        address otherDefender = makeAddr("otherDefender");
        IBreakBase.ChallengeConfig memory config = _defaultConfig();
        config.defender = otherDefender;

        (address clone,) = factory.createProtocolChallenge(config, 0);
        Challenge c = Challenge(clone);
        assertEq(c.defender(), otherDefender, "defender can be anyone via protocol");
    }

    // =========================================================================
    // getChallengeCount
    // =========================================================================

    function test_getChallengeCount_incrementsCorrectly() public {
        assertEq(factory.getChallengeCount(), 0, "starts at 0");

        IBreakBase.ChallengeConfig memory config = _defaultConfig();

        vm.prank(defenderAddr);
        factory.createChallenge(config, 0);
        assertEq(factory.getChallengeCount(), 1);

        vm.prank(defenderAddr);
        factory.createChallenge(config, 0);
        assertEq(factory.getChallengeCount(), 2);

        vm.prank(defenderAddr);
        factory.createChallenge(config, 0);
        assertEq(factory.getChallengeCount(), 3);
    }

    // =========================================================================
    // Admin: setOracle
    // =========================================================================

    function test_setOracle_onlyOwner() public {
        address newOracle = makeAddr("newOracle");

        factory.setOracle(newOracle);
        assertEq(factory.oracle(), newOracle);

        vm.prank(nonOwner);
        vm.expectRevert();
        factory.setOracle(makeAddr("another"));
    }

    function test_setOracle_reverts_zeroAddress() public {
        vm.expectRevert(IBreakBase.ZeroAddress.selector);
        factory.setOracle(address(0));
    }

    function test_setOracle_onlyAffectsFutureChallenges() public {
        IBreakBase.ChallengeConfig memory config = _defaultConfig();
        vm.prank(defenderAddr);
        (address clone1,) = factory.createChallenge(config, 0);

        address newOracle = makeAddr("newOracle");
        factory.setOracle(newOracle);

        vm.prank(defenderAddr);
        (address clone2,) = factory.createChallenge(config, 0);

        assertEq(Challenge(clone1).oracle(), oracleAddr, "old challenge keeps old oracle");
        assertEq(Challenge(clone2).oracle(), newOracle, "new challenge uses new oracle");
    }

    // =========================================================================
    // Admin: setProtocolWallet
    // =========================================================================

    function test_setProtocolWallet_onlyOwner() public {
        address newWallet = makeAddr("newWallet");

        factory.setProtocolWallet(newWallet);
        assertEq(factory.protocolWallet(), newWallet);

        vm.prank(nonOwner);
        vm.expectRevert();
        factory.setProtocolWallet(makeAddr("another"));
    }

    function test_setProtocolWallet_reverts_zeroAddress() public {
        vm.expectRevert(IBreakBase.ZeroAddress.selector);
        factory.setProtocolWallet(address(0));
    }

    // =========================================================================
    // Admin: setMinBasePrice
    // =========================================================================

    function test_setMinBasePrice_updates() public {
        factory.setMinBasePrice(50_000);
        assertEq(factory.minBasePrice(), 50_000);
    }

    function test_setMinBasePrice_reverts_zero() public {
        vm.expectRevert(IBreakBase.ZeroAmount.selector);
        factory.setMinBasePrice(0);
    }

    function test_setMinBasePrice_onlyOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        factory.setMinBasePrice(50_000);
    }

    // =========================================================================
    // Admin: setMaxDuration
    // =========================================================================

    function test_setMaxDuration_updates() public {
        factory.setMaxDuration(60 days);
        assertEq(factory.maxDuration(), 60 days);
    }

    function test_setMaxDuration_reverts_zero() public {
        vm.expectRevert(IBreakBase.InvalidDuration.selector);
        factory.setMaxDuration(0);
    }

    function test_setMaxDuration_onlyOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        factory.setMaxDuration(60 days);
    }

    // =========================================================================
    // Events
    // =========================================================================

    function test_createChallenge_emitsEvent() public {
        IBreakBase.ChallengeConfig memory config = _defaultConfig();

        vm.prank(defenderAddr);
        // We cannot predict the clone address, so just check the event is emitted
        vm.recordLogs();
        factory.createChallenge(config, 0);

        // Verify at least one ChallengeCreated log was emitted
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool found = false;
        bytes32 eventSig = keccak256("ChallengeCreated(bytes32,address,address,uint256,uint48,uint8)");
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == eventSig) {
                found = true;
                break;
            }
        }
        assertTrue(found, "ChallengeCreated event emitted");
    }

    // =========================================================================
    // getChallenge
    // =========================================================================

    function test_getChallenge_returnsCloneAddress() public {
        IBreakBase.ChallengeConfig memory config = _defaultConfig();
        vm.prank(defenderAddr);
        (address clone, bytes32 id) = factory.createChallenge(config, 0);

        assertEq(factory.getChallenge(id), clone);
    }

    function test_getChallenge_returnsZeroForUnknownId() public view {
        assertEq(factory.getChallenge(bytes32(uint256(999))), address(0));
    }

    // =========================================================================
    // allChallenges array
    // =========================================================================

    function test_allChallenges_tracksDeployments() public {
        IBreakBase.ChallengeConfig memory config = _defaultConfig();

        vm.prank(defenderAddr);
        (address clone1,) = factory.createChallenge(config, 0);

        vm.prank(defenderAddr);
        (address clone2,) = factory.createChallenge(config, 0);

        assertEq(factory.allChallenges(0), clone1);
        assertEq(factory.allChallenges(1), clone2);
    }

    // =========================================================================
    // Escalating pricing validation (audit fixes)
    // =========================================================================

    function test_createChallenge_reverts_escalating_zeroGrowthRate() public {
        IBreakBase.ChallengeConfig memory config = _defaultConfig();
        config.pricingModel = IBreakBase.PricingModel.Escalating;
        config.growthRateBps = 0;
        config.maxFee = 10_000_000; // $10

        vm.prank(defenderAddr);
        vm.expectRevert(IBreakBase.InvalidGrowthRate.selector);
        factory.createChallenge(config, 0);
    }

    function test_createChallenge_reverts_escalating_zeroMaxFee() public {
        IBreakBase.ChallengeConfig memory config = _defaultConfig();
        config.pricingModel = IBreakBase.PricingModel.Escalating;
        config.growthRateBps = 500;
        config.maxFee = 0;

        vm.prank(defenderAddr);
        vm.expectRevert(IBreakBase.MaxFeeRequired.selector);
        factory.createChallenge(config, 0);
    }

    function test_createChallenge_reverts_escalating_maxFeeBelowBasePrice() public {
        IBreakBase.ChallengeConfig memory config = _defaultConfig();
        config.pricingModel = IBreakBase.PricingModel.Escalating;
        config.growthRateBps = 500;
        config.basePrice = 1_000_000; // $1
        config.maxFee = 500_000; // $0.50, below basePrice

        vm.prank(defenderAddr);
        vm.expectRevert(IBreakBase.MaxFeeBelowBasePrice.selector);
        factory.createChallenge(config, 0);
    }

    function test_createChallenge_escalating_validConfig() public {
        IBreakBase.ChallengeConfig memory config = _defaultConfig();
        config.pricingModel = IBreakBase.PricingModel.Escalating;
        config.growthRateBps = 500;
        config.maxFee = 10_000_000; // $10, above basePrice of $1

        vm.prank(defenderAddr);
        (address clone,) = factory.createChallenge(config, 0);
        assertTrue(clone != address(0), "escalating clone deployed");
    }

    // =========================================================================
    // Pausable
    // =========================================================================

    function test_pause_onlyOwner() public {
        // Owner can pause
        factory.pause();
        assertTrue(factory.paused(), "factory should be paused");

        // Non-owner cannot pause
        factory.unpause();
        vm.prank(nonOwner);
        vm.expectRevert();
        factory.pause();
    }

    function test_unpause_onlyOwner() public {
        factory.pause();
        assertTrue(factory.paused(), "factory paused");

        // Non-owner cannot unpause
        vm.prank(nonOwner);
        vm.expectRevert();
        factory.unpause();

        // Owner can unpause
        factory.unpause();
        assertFalse(factory.paused(), "factory should be unpaused");
    }

    function test_createChallenge_reverts_whenPaused() public {
        factory.pause();

        IBreakBase.ChallengeConfig memory config = _defaultConfig();

        vm.prank(defenderAddr);
        vm.expectRevert();
        factory.createChallenge(config, 0);
    }

    function test_createProtocolChallenge_reverts_whenPaused() public {
        factory.pause();

        IBreakBase.ChallengeConfig memory config = _defaultConfig();

        // Even the owner cannot create when paused
        vm.expectRevert();
        factory.createProtocolChallenge(config, 0);
    }

    function test_unpause_allowsCreation() public {
        // Pause, then unpause
        factory.pause();
        assertTrue(factory.paused(), "paused");
        factory.unpause();
        assertFalse(factory.paused(), "unpaused");

        // Creating a challenge should succeed again
        IBreakBase.ChallengeConfig memory config = _defaultConfig();
        vm.prank(defenderAddr);
        (address clone,) = factory.createChallenge(config, 0);
        assertTrue(clone != address(0), "clone deployed after unpause");
    }

    // =========================================================================
    // Multicall
    // =========================================================================

    function test_multicall_batchAdminCalls() public {
        address newOracle = makeAddr("batchOracle");
        uint256 newMinPrice = 50_000;

        // Encode two admin calls into a single multicall
        bytes[] memory calls = new bytes[](2);
        calls[0] = abi.encodeWithSelector(factory.setOracle.selector, newOracle);
        calls[1] = abi.encodeWithSelector(factory.setMinBasePrice.selector, newMinPrice);

        // Execute both in a single transaction
        factory.multicall(calls);

        assertEq(factory.oracle(), newOracle, "oracle updated via multicall");
        assertEq(factory.minBasePrice(), newMinPrice, "minBasePrice updated via multicall");
    }

    // =========================================================================
    // isChallengeClone
    // =========================================================================

    function test_isChallengeClone_true() public {
        IBreakBase.ChallengeConfig memory config = _defaultConfig();

        vm.prank(defenderAddr);
        (address clone,) = factory.createChallenge(config, 0);

        assertTrue(factory.isChallengeClone(clone), "factory-deployed clone recognized");
    }

    function test_isChallengeClone_false() public {
        address random = makeAddr("randomAddress");
        assertFalse(factory.isChallengeClone(random), "random address not a clone");
    }

    // =========================================================================
    // Coinbase Verification: setCoinbaseVerification
    // =========================================================================

    function test_setCoinbaseVerification_onlyOwner() public {
        address attesterAddr = makeAddr("coinbaseAttester");
        bytes32 schemaId = keccak256("coinbaseSchema");

        // Non-owner cannot call
        vm.prank(nonOwner);
        vm.expectRevert();
        factory.setCoinbaseVerification(true, attesterAddr, schemaId);

        // Owner can call
        factory.setCoinbaseVerification(true, attesterAddr, schemaId);
        assertTrue(factory.requireCoinbaseVerification(), "verification enabled");
        assertEq(factory.coinbaseAttester(), attesterAddr, "attester set");
        assertEq(factory.verifiedAccountSchemaId(), schemaId, "schema set");
    }

    function test_setCoinbaseVerification_emitsEvent() public {
        address attesterAddr = makeAddr("coinbaseAttester");
        bytes32 schemaId = keccak256("coinbaseSchema");

        vm.expectEmit(false, false, false, true);
        emit ChallengeFactory.CoinbaseVerificationUpdated(true, attesterAddr, schemaId);

        factory.setCoinbaseVerification(true, attesterAddr, schemaId);
    }

    // =========================================================================
    // Coinbase Verification: createChallenge behavior
    // =========================================================================

    function test_createChallenge_withVerification_reverts_noEAS() public {
        // The default factory has eas = address(0).
        // Enable verification: when _checkCoinbaseVerification runs, it should
        // revert with EASNotConfigured because eas is address(0).
        address attesterAddr = makeAddr("coinbaseAttester");
        bytes32 schemaId = keccak256("coinbaseSchema");
        factory.setCoinbaseVerification(true, attesterAddr, schemaId);

        IBreakBase.ChallengeConfig memory config = _defaultConfig();

        vm.prank(defenderAddr);
        vm.expectRevert(IBreakBase.EASNotConfigured.selector);
        factory.createChallenge(config, 0);
    }

    function test_createChallenge_withVerification_reverts_invalidAttestation() public {
        // Deploy a factory with a real MockEAS so eas != address(0)
        MockEAS mockEas = new MockEAS();
        ChallengeFactory factoryWithEas =
            new ChallengeFactory(address(implementation), protocolWallet, oracleAddr, address(usdc), address(mockEas));

        // Enable verification with arbitrary attester/schema.
        // MockEAS.getAttestation returns a zero-initialized Attestation struct,
        // so the validation (uid != 0, schema match, attester match, etc.) will fail.
        address attesterAddr = makeAddr("coinbaseAttester");
        bytes32 schemaId = keccak256("coinbaseSchema");
        factoryWithEas.setCoinbaseVerification(true, attesterAddr, schemaId);

        IBreakBase.ChallengeConfig memory config = _defaultConfig();

        vm.prank(defenderAddr);
        vm.expectRevert(IBreakBase.CoinbaseVerificationRequired.selector);
        factoryWithEas.createChallenge(config, 0);
    }

    function test_createChallenge_withoutVerification_succeeds() public {
        // Default state: requireCoinbaseVerification is false.
        // Challenges should be created normally.
        IBreakBase.ChallengeConfig memory config = _defaultConfig();

        vm.prank(defenderAddr);
        (address clone,) = factory.createChallenge(config, 0);
        assertTrue(clone != address(0), "clone deployed without verification");
    }

    // =========================================================================
    // Listing Fees
    // =========================================================================

    function test_setListingFee_onlyOwner() public {
        uint256 fee = 5_000_000; // $5.00
        factory.setListingFee(fee);
        assertEq(factory.listingFee(), fee, "listing fee set");

        vm.prank(nonOwner);
        vm.expectRevert();
        factory.setListingFee(fee);
    }

    function test_setListingFee_emitsEvent() public {
        uint256 newFee = 5_000_000;

        vm.expectEmit(false, false, false, true);
        emit IBreakBase.ListingFeeUpdated(0, newFee);

        factory.setListingFee(newFee);
    }

    function test_setListingFee_canSetToZero() public {
        factory.setListingFee(5_000_000);
        assertEq(factory.listingFee(), 5_000_000, "fee set");

        factory.setListingFee(0);
        assertEq(factory.listingFee(), 0, "fee reset to zero");
    }

    function test_listingFee_defaultsToZero() public view {
        assertEq(factory.listingFee(), 0, "default listing fee is zero");
    }

    function test_createChallenge_collectsListingFee() public {
        uint256 fee = 2_000_000; // $2.00
        factory.setListingFee(fee);

        // Mint USDC to defender and approve factory
        usdc.mint(defenderAddr, fee);
        vm.prank(defenderAddr);
        usdc.approve(address(factory), fee);

        uint256 protoBefore = usdc.balanceOf(protocolWallet);
        uint256 defBefore = usdc.balanceOf(defenderAddr);

        IBreakBase.ChallengeConfig memory config = _defaultConfig();
        vm.prank(defenderAddr);
        (address clone,) = factory.createChallenge(config, 0);

        assertTrue(clone != address(0), "clone deployed");
        assertEq(usdc.balanceOf(protocolWallet) - protoBefore, fee, "protocol wallet received listing fee");
        assertEq(defBefore - usdc.balanceOf(defenderAddr), fee, "defender paid listing fee");
    }

    function test_createChallenge_noFeeWhenZero() public {
        // Listing fee is 0 (default), no USDC transfer should happen
        IBreakBase.ChallengeConfig memory config = _defaultConfig();

        uint256 protoBefore = usdc.balanceOf(protocolWallet);

        vm.prank(defenderAddr);
        (address clone,) = factory.createChallenge(config, 0);

        assertTrue(clone != address(0), "clone deployed");
        assertEq(usdc.balanceOf(protocolWallet), protoBefore, "no fee collected when listing fee is zero");
    }

    function test_createChallenge_reverts_insufficientAllowanceForFee() public {
        uint256 fee = 2_000_000;
        factory.setListingFee(fee);

        // Mint USDC but do NOT approve
        usdc.mint(defenderAddr, fee);

        IBreakBase.ChallengeConfig memory config = _defaultConfig();

        vm.prank(defenderAddr);
        vm.expectRevert();
        factory.createChallenge(config, 0);
    }

    function test_createChallenge_listingFeeEmitsEvent() public {
        uint256 fee = 1_000_000;
        factory.setListingFee(fee);

        usdc.mint(defenderAddr, fee);
        vm.prank(defenderAddr);
        usdc.approve(address(factory), fee);

        IBreakBase.ChallengeConfig memory config = _defaultConfig();

        vm.prank(defenderAddr);
        vm.recordLogs();
        factory.createChallenge(config, 0);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 eventSig = keccak256("ListingFeeCollected(bytes32,address,uint256)");
        bool found = false;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == eventSig) {
                found = true;
                break;
            }
        }
        assertTrue(found, "ListingFeeCollected event emitted");
    }

    function test_createProtocolChallenge_collectsListingFee() public {
        uint256 fee = 3_000_000;
        factory.setListingFee(fee);

        // Owner (this contract) creates protocol challenge, so owner pays fee
        usdc.mint(address(this), fee);
        usdc.approve(address(factory), fee);

        uint256 protoBefore = usdc.balanceOf(protocolWallet);

        IBreakBase.ChallengeConfig memory config = _defaultConfig();
        (address clone,) = factory.createProtocolChallenge(config, 0);

        assertTrue(clone != address(0), "clone deployed");
        assertEq(usdc.balanceOf(protocolWallet) - protoBefore, fee, "protocol wallet received listing fee");
    }

    function test_setListingFee_emitsOldAndNewFee() public {
        uint256 firstFee = 1_000_000;
        uint256 secondFee = 5_000_000;

        factory.setListingFee(firstFee);

        vm.expectEmit(false, false, false, true);
        emit IBreakBase.ListingFeeUpdated(firstFee, secondFee);

        factory.setListingFee(secondFee);
    }

    // =========================================================================
    // Prize Pool Seeding via createChallenge
    // =========================================================================

    function test_createChallenge_withSeed_seedsPrizePool() public {
        uint256 seedAmount = 5_000_000; // $5

        usdc.mint(defenderAddr, seedAmount);
        vm.startPrank(defenderAddr);
        usdc.approve(address(factory), seedAmount);

        IBreakBase.ChallengeConfig memory config = _defaultConfig();
        (address clone,) = factory.createChallenge(config, seedAmount);
        vm.stopPrank();

        assertEq(Challenge(clone).prizePool(), seedAmount, "prize pool seeded");
    }

    function test_createChallenge_withSeed_transfersUSDC() public {
        uint256 seedAmount = 5_000_000; // $5

        usdc.mint(defenderAddr, seedAmount);
        vm.startPrank(defenderAddr);
        usdc.approve(address(factory), seedAmount);

        uint256 defenderBefore = usdc.balanceOf(defenderAddr);

        IBreakBase.ChallengeConfig memory config = _defaultConfig();
        (address clone,) = factory.createChallenge(config, seedAmount);
        vm.stopPrank();

        assertEq(defenderBefore - usdc.balanceOf(defenderAddr), seedAmount, "defender paid seed amount");
        assertEq(usdc.balanceOf(clone), seedAmount, "clone holds USDC");
        assertEq(usdc.balanceOf(address(factory)), 0, "factory holds no USDC residual");
    }

    function test_createChallenge_withSeed_emitsPrizePoolSeeded() public {
        uint256 seedAmount = 5_000_000;

        usdc.mint(defenderAddr, seedAmount);
        vm.startPrank(defenderAddr);
        usdc.approve(address(factory), seedAmount);

        IBreakBase.ChallengeConfig memory config = _defaultConfig();

        vm.recordLogs();
        factory.createChallenge(config, seedAmount);
        vm.stopPrank();

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 eventSig = keccak256("PrizePoolSeeded(address,address,uint256)");
        bool found = false;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == eventSig) {
                found = true;
                break;
            }
        }
        assertTrue(found, "PrizePoolSeeded event emitted");
    }

    function test_createChallenge_withSeed_zeroAmount_noTransfer() public {
        IBreakBase.ChallengeConfig memory config = _defaultConfig();

        uint256 defenderBefore = usdc.balanceOf(defenderAddr);

        vm.prank(defenderAddr);
        (address clone,) = factory.createChallenge(config, 0);

        assertTrue(clone != address(0), "clone deployed");
        assertEq(usdc.balanceOf(defenderAddr), defenderBefore, "no USDC moved");
        assertEq(Challenge(clone).prizePool(), 0, "prize pool is zero");
    }

    function test_createChallenge_withSeed_reverts_insufficientBalance() public {
        uint256 seedAmount = 5_000_000;

        // Defender has no USDC but approves anyway
        vm.startPrank(defenderAddr);
        usdc.approve(address(factory), seedAmount);

        IBreakBase.ChallengeConfig memory config = _defaultConfig();

        vm.expectRevert();
        factory.createChallenge(config, seedAmount);
        vm.stopPrank();
    }

    function test_createChallenge_withSeed_andListingFee() public {
        uint256 seedAmount = 5_000_000; // $5
        uint256 fee = 2_000_000; // $2
        factory.setListingFee(fee);

        uint256 totalNeeded = seedAmount + fee;
        usdc.mint(defenderAddr, totalNeeded);
        vm.startPrank(defenderAddr);
        usdc.approve(address(factory), totalNeeded);

        IBreakBase.ChallengeConfig memory config = _defaultConfig();
        (address clone,) = factory.createChallenge(config, seedAmount);
        vm.stopPrank();

        assertEq(Challenge(clone).prizePool(), seedAmount, "prize pool seeded");
        assertEq(usdc.balanceOf(clone), seedAmount, "clone holds seed USDC");
        assertEq(usdc.balanceOf(protocolWallet), fee, "protocol wallet received listing fee");
        assertEq(usdc.balanceOf(defenderAddr), 0, "defender spent all USDC");
    }

    function test_createProtocolChallenge_withSeed() public {
        uint256 seedAmount = 10_000_000; // $10

        usdc.mint(address(this), seedAmount);
        usdc.approve(address(factory), seedAmount);

        IBreakBase.ChallengeConfig memory config = _defaultConfig();
        (address clone,) = factory.createProtocolChallenge(config, seedAmount);

        assertEq(Challenge(clone).prizePool(), seedAmount, "prize pool seeded via protocol challenge");
        assertEq(usdc.balanceOf(clone), seedAmount, "clone holds USDC");
    }
}
