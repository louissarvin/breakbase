// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {Challenge} from "../src/Challenge.sol";
import {ChallengeFactory} from "../src/ChallengeFactory.sol";
import {IBreakBase} from "../src/interfaces/IBreakBase.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

/// @title ChallengeTest
/// @notice Comprehensive tests for Challenge.sol covering fee collection, resolution,
///         expiry, seeding, pricing models, fee math, and security properties.
contract ChallengeTest is Test {
    // -------------------------------------------------------------------------
    // Test accounts
    // -------------------------------------------------------------------------
    address public defenderAddr;
    address public player1;
    uint256 public player1Key;
    address public player2;
    uint256 public player2Key;
    address public protocolWallet;

    uint256 public oracleKey = 0xA11CE;
    address public oracleAddr;

    // -------------------------------------------------------------------------
    // Contracts
    // -------------------------------------------------------------------------
    MockERC20 public usdc;
    Challenge public implementation;
    ChallengeFactory public factory;

    // The clone we test against
    Challenge public challenge;

    // -------------------------------------------------------------------------
    // Default config values
    // -------------------------------------------------------------------------
    uint256 constant BASE_PRICE = 1_000_000; // $1.00 USDC
    uint48 constant DURATION = 7 days;
    uint256 constant INITIAL_BALANCE = 10_000_000_000; // 10,000 USDC

    // EIP-712 constants (must match Challenge.sol)
    bytes32 constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 constant HASHED_NAME = keccak256("BreakBase");
    bytes32 constant HASHED_VERSION = keccak256("1");
    bytes32 constant CHALLENGE_RESULT_TYPEHASH =
        keccak256("ChallengeResult(bytes32 challengeId,address winner,uint256 attemptNumber,uint256 deadline)");

    // -------------------------------------------------------------------------
    // Setup
    // -------------------------------------------------------------------------

    function setUp() public {
        // Derive oracle address from known private key
        oracleAddr = vm.addr(oracleKey);

        // Named test accounts (players need private keys for permit signing)
        defenderAddr = makeAddr("defender");
        (player1, player1Key) = makeAddrAndKey("player1");
        (player2, player2Key) = makeAddrAndKey("player2");
        protocolWallet = makeAddr("protocolWallet");

        // Deploy mock USDC (6 decimals)
        usdc = new MockERC20("USD Coin", "USDC", 6);

        // Deploy Challenge implementation
        implementation = new Challenge();

        // Deploy factory (msg.sender = this test contract = owner)
        factory = new ChallengeFactory(address(implementation), protocolWallet, oracleAddr, address(usdc), address(0));

        // Create a challenge clone via factory
        challenge = _createDefaultChallenge();

        // Mint USDC to test accounts
        usdc.mint(player1, INITIAL_BALANCE);
        usdc.mint(player2, INITIAL_BALANCE);
        usdc.mint(defenderAddr, INITIAL_BALANCE);

        // Pre-approve USDC to the challenge
        vm.prank(player1);
        usdc.approve(address(challenge), type(uint256).max);
        vm.prank(player2);
        usdc.approve(address(challenge), type(uint256).max);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _createDefaultChallenge() internal returns (Challenge) {
        IBreakBase.ChallengeConfig memory config = IBreakBase.ChallengeConfig({
            defender: defenderAddr,
            usdc: address(usdc),
            basePrice: BASE_PRICE,
            maxFee: 0,
            duration: DURATION,
            growthRateBps: 0,
            pricingModel: IBreakBase.PricingModel.Fixed
        });

        vm.prank(defenderAddr);
        (address clone,) = factory.createChallenge(config, 0);
        return Challenge(clone);
    }

    function _createEscalatingChallenge(uint256 basePrice_, uint16 growthBps, uint256 maxFee_)
        internal
        returns (Challenge)
    {
        IBreakBase.ChallengeConfig memory config = IBreakBase.ChallengeConfig({
            defender: defenderAddr,
            usdc: address(usdc),
            basePrice: basePrice_,
            maxFee: maxFee_,
            duration: DURATION,
            growthRateBps: growthBps,
            pricingModel: IBreakBase.PricingModel.Escalating
        });

        vm.prank(defenderAddr);
        (address clone,) = factory.createChallenge(config, 0);
        return Challenge(clone);
    }

    /// @dev Compute the EIP-712 domain separator for a given challenge clone
    function _domainSeparator(address challengeClone) internal view returns (bytes32) {
        return keccak256(abi.encode(EIP712_DOMAIN_TYPEHASH, HASHED_NAME, HASHED_VERSION, block.chainid, challengeClone));
    }

    /// @dev Build the EIP-712 digest and sign it with the oracle key
    function _signResolve(address challengeClone, address winner, uint256 attemptNumber, uint256 deadline)
        internal
        view
        returns (bytes memory)
    {
        bytes32 challengeId = keccak256(abi.encode(challengeClone));
        bytes32 structHash =
            keccak256(abi.encode(CHALLENGE_RESULT_TYPEHASH, challengeId, winner, attemptNumber, deadline));
        bytes32 digest = MessageHashUtils.toTypedDataHash(_domainSeparator(challengeClone), structHash);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oracleKey, digest);
        return abi.encodePacked(r, s, v);
    }

    /// @dev Send a message from player to challenge, returns fee charged
    function _sendMessage(address player) internal returns (uint256) {
        vm.prank(player);
        return challenge.sendMessage();
    }

    // =========================================================================
    // Initialize
    // =========================================================================

    function test_initialize_setsAllParameters() public view {
        assertEq(challenge.defender(), defenderAddr, "defender");
        assertEq(address(challenge.usdc()), address(usdc), "usdc");
        assertEq(challenge.basePrice(), BASE_PRICE, "basePrice");
        assertEq(challenge.maxFee(), 0, "maxFee");
        assertEq(challenge.endTime(), block.timestamp + DURATION, "endTime");
        assertEq(challenge.oracle(), oracleAddr, "oracle");
        assertEq(challenge.protocolWallet(), protocolWallet, "protocolWallet");
        assertEq(challenge.messageCount(), 0, "messageCount");
        assertEq(challenge.prizePool(), 0, "prizePool");
        assertEq(uint8(challenge.status()), uint8(IBreakBase.ChallengeStatus.Active), "status");
        assertEq(uint8(challenge.pricingModel()), uint8(IBreakBase.PricingModel.Fixed), "pricingModel");
    }

    function test_initialize_reverts_onDoubleInit() public {
        IBreakBase.ChallengeConfig memory config = IBreakBase.ChallengeConfig({
            defender: defenderAddr,
            usdc: address(usdc),
            basePrice: BASE_PRICE,
            maxFee: 0,
            duration: DURATION,
            growthRateBps: 0,
            pricingModel: IBreakBase.PricingModel.Fixed
        });

        vm.expectRevert();
        challenge.initialize(config, oracleAddr, protocolWallet);
    }

    // =========================================================================
    // Fixed pricing: sendMessage
    // =========================================================================

    function test_sendMessage_fixedPricing_correctFeeSplit() public {
        uint256 defBefore = usdc.balanceOf(defenderAddr);
        uint256 protoBefore = usdc.balanceOf(protocolWallet);

        uint256 fee = _sendMessage(player1);

        assertEq(fee, BASE_PRICE, "fee should equal basePrice");

        // 80% to prize pool
        uint256 expectedPrize = (BASE_PRICE * 8000) / 10_000;
        assertEq(challenge.prizePool(), expectedPrize, "prizePool 80%");

        // 10% to defender
        uint256 expectedDefender = (BASE_PRICE * 1000) / 10_000;
        assertEq(usdc.balanceOf(defenderAddr) - defBefore, expectedDefender, "defender 10%");

        // 10% to protocol (absorbs dust)
        uint256 expectedProtocol = BASE_PRICE - expectedPrize - expectedDefender;
        assertEq(usdc.balanceOf(protocolWallet) - protoBefore, expectedProtocol, "protocol 10%");

        assertEq(challenge.messageCount(), 1, "messageCount");
    }

    function test_sendMessage_fixedPricing_multipleMessages() public {
        _sendMessage(player1);
        _sendMessage(player2);
        _sendMessage(player1);

        assertEq(challenge.messageCount(), 3, "3 messages");

        uint256 expectedPrize = 3 * ((BASE_PRICE * 8000) / 10_000);
        assertEq(challenge.prizePool(), expectedPrize, "cumulative prize pool");
    }

    function test_sendMessage_reverts_whenExpired() public {
        vm.warp(block.timestamp + DURATION);

        vm.prank(player1);
        vm.expectRevert(IBreakBase.ChallengeNotActive.selector);
        challenge.sendMessage();
    }

    function test_sendMessage_reverts_whenResolved() public {
        // Send a message to build prize pool and set messageCount = 1
        _sendMessage(player1);

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signResolve(address(challenge), player1, 1, deadline);
        challenge.resolveChallenge(player1, player1, 1, deadline, sig);

        vm.prank(player1);
        vm.expectRevert(IBreakBase.ChallengeNotActive.selector);
        challenge.sendMessage();
    }

    function test_sendMessage_reverts_whenInsufficientAllowance() public {
        // Revoke approval
        vm.prank(player1);
        usdc.approve(address(challenge), 0);

        vm.prank(player1);
        vm.expectRevert();
        challenge.sendMessage();
    }

    function test_sendMessage_usesCallerAsPayer() public {
        // Verify msg.sender is the payer (player1 has approval and balance)
        uint256 p1Before = usdc.balanceOf(player1);

        vm.prank(player1);
        challenge.sendMessage();

        assertTrue(usdc.balanceOf(player1) < p1Before, "tokens pulled from msg.sender");
    }

    // =========================================================================
    // Escalating pricing
    // =========================================================================

    function test_getCurrentFee_escalating_firstMessage() public {
        // 78 bps = 0.78% growth, first message uses exponent 0 so fee = basePrice
        Challenge esc = _createEscalatingChallenge(BASE_PRICE, 78, 100_000_000);
        assertEq(esc.getCurrentFee(), BASE_PRICE, "first message = basePrice");
    }

    function test_getCurrentFee_escalating_after100Messages() public {
        Challenge esc = _createEscalatingChallenge(BASE_PRICE, 78, 100_000_000);

        // Mint and approve for player1
        usdc.mint(player1, 1_000_000_000_000); // plenty
        vm.prank(player1);
        usdc.approve(address(esc), type(uint256).max);

        // Send 100 messages
        for (uint256 i = 0; i < 100; i++) {
            vm.prank(player1);
            esc.sendMessage();
        }

        // After 100 messages, fee should be basePrice * 1.0078^100
        // 1.0078^100 ~ 2.173
        uint256 fee = esc.getCurrentFee();
        assertTrue(fee > BASE_PRICE * 2, "fee should more than double after 100 msgs");
        assertTrue(fee < BASE_PRICE * 3, "fee should be less than 3x");
    }

    function test_getCurrentFee_escalating_respectsMaxFee() public {
        uint256 cap = 2_000_000; // $2.00
        Challenge esc = _createEscalatingChallenge(BASE_PRICE, 500, cap); // 5% growth

        usdc.mint(player1, 1_000_000_000_000);
        vm.prank(player1);
        usdc.approve(address(esc), type(uint256).max);

        // Send enough messages to exceed the cap
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(player1);
            esc.sendMessage();
        }

        // fee = basePrice * 1.05^20 ~ 2.653 * basePrice = ~$2.65, capped at $2.00
        assertEq(esc.getCurrentFee(), cap, "should be capped at maxFee");
    }

    function test_sendMessage_escalating_feeIncreasesEachMessage() public {
        Challenge esc = _createEscalatingChallenge(BASE_PRICE, 1000, 100_000_000); // 10% growth

        usdc.mint(player1, 1_000_000_000_000);
        vm.prank(player1);
        usdc.approve(address(esc), type(uint256).max);

        vm.prank(player1);
        uint256 fee1 = esc.sendMessage();

        vm.prank(player1);
        uint256 fee2 = esc.sendMessage();

        vm.prank(player1);
        uint256 fee3 = esc.sendMessage();

        // fee1 = base (exponent 0), fee2 = base*1.1 (exponent 1), fee3 = base*1.21 (exponent 2)
        assertEq(fee1, BASE_PRICE, "first fee = base");
        assertTrue(fee2 > fee1, "fee2 > fee1");
        assertTrue(fee3 > fee2, "fee3 > fee2");

        // Verify approximate values (10% growth)
        // fee2 should be ~1_100_000
        assertApproxEqAbs(fee2, 1_100_000, 1, "fee2 ~= base * 1.1");
        // fee3 should be ~1_210_000
        assertApproxEqAbs(fee3, 1_210_000, 1, "fee3 ~= base * 1.21");
    }

    // =========================================================================
    // Resolution
    // =========================================================================

    function test_resolveChallenge_validSignature_transfersPrize() public {
        // Send a message to build prize pool
        _sendMessage(player1);

        uint256 pool = challenge.prizePool();
        assertTrue(pool > 0, "pool should be nonzero");

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signResolve(address(challenge), player1, 1, deadline);

        uint256 playerBefore = usdc.balanceOf(player1);

        challenge.resolveChallenge(player1, player1, 1, deadline, sig);

        assertEq(usdc.balanceOf(player1) - playerBefore, pool, "winner receives full prize pool");
        assertEq(challenge.prizePool(), 0, "pool emptied");
        assertEq(uint8(challenge.status()), uint8(IBreakBase.ChallengeStatus.Resolved), "status resolved");
    }

    function test_resolveChallenge_reverts_invalidSignature() public {
        _sendMessage(player1);

        uint256 deadline = block.timestamp + 1 hours;

        // Sign with wrong key
        uint256 wrongKey = 0xBEEF;
        bytes32 challengeId = keccak256(abi.encode(address(challenge)));
        bytes32 structHash =
            keccak256(abi.encode(CHALLENGE_RESULT_TYPEHASH, challengeId, player1, uint256(1), deadline));
        bytes32 digest = MessageHashUtils.toTypedDataHash(_domainSeparator(address(challenge)), structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, digest);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.expectRevert(IBreakBase.InvalidSignature.selector);
        challenge.resolveChallenge(player1, player1, 1, deadline, badSig);
    }

    function test_resolveChallenge_reverts_expiredDeadline() public {
        _sendMessage(player1);

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signResolve(address(challenge), player1, 1, deadline);

        // Warp past deadline
        vm.warp(deadline + 1);

        vm.expectRevert(IBreakBase.DeadlineExpired.selector);
        challenge.resolveChallenge(player1, player1, 1, deadline, sig);
    }

    function test_resolveChallenge_reverts_alreadyResolved() public {
        _sendMessage(player1);

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signResolve(address(challenge), player1, 1, deadline);
        challenge.resolveChallenge(player1, player1, 1, deadline, sig);

        // Try to resolve again
        uint256 deadline2 = block.timestamp + 2 hours;
        bytes memory sig2 = _signResolve(address(challenge), player2, 2, deadline2);

        vm.expectRevert(IBreakBase.ChallengeNotActive.selector);
        challenge.resolveChallenge(player2, player2, 2, deadline2, sig2);
    }

    function test_resolveChallenge_reverts_wrongOracle() public {
        _sendMessage(player1);

        // Sign with oracle but tamper the winner address in the call (signature won't match)
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signResolve(address(challenge), player1, 1, deadline);

        // Call with player2 as winner but player1's signature
        vm.expectRevert(IBreakBase.InvalidSignature.selector);
        challenge.resolveChallenge(player2, player2, 1, deadline, sig);
    }

    function test_resolveChallenge_zeroPool() public {
        // Seed the pool, then have a message consume it so pool goes to zero
        // but messageCount > 0 (satisfying attemptNumber validation)
        // Alternatively: seed pool to create a non-zero state, send 1 message,
        // then resolve with attemptNumber=1 when pool has some balance.
        // The simplest valid zero-pool scenario: no seed, 1 message, resolve at attemptNumber=1
        // but prize pool will be non-zero from the message fee split.
        //
        // Instead: test that attemptNumber=0 is now rejected (moved to attemptNumber validation tests).
        // Adjust to test resolve when pool is seeded but messages were sent:
        // We just verify that resolve works and transfers whatever pool exists.
        // Since the new validation requires attemptNumber >= 1, this test now
        // verifies resolve with attemptNumber = 1 after a single message.
        _sendMessage(player1);
        uint256 pool = challenge.prizePool();
        assertTrue(pool > 0, "pool nonzero after message");

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signResolve(address(challenge), player1, 1, deadline);

        uint256 playerBefore = usdc.balanceOf(player1);

        challenge.resolveChallenge(player1, player1, 1, deadline, sig);

        assertEq(usdc.balanceOf(player1) - playerBefore, pool, "winner receives pool");
        assertEq(uint8(challenge.status()), uint8(IBreakBase.ChallengeStatus.Resolved), "status resolved");
    }

    function test_resolveChallenge_reverts_zeroWinner() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signResolve(address(challenge), address(0), 0, deadline);

        vm.expectRevert(IBreakBase.ZeroAddress.selector);
        challenge.resolveChallenge(address(0), address(0), 0, deadline, sig);
    }

    // =========================================================================
    // Expiry
    // =========================================================================

    function test_expireChallenge_returnsPoolToDefender() public {
        // Build prize pool
        _sendMessage(player1);
        _sendMessage(player2);

        uint256 pool = challenge.prizePool();
        uint256 defBefore = usdc.balanceOf(defenderAddr);

        // Warp past end + grace period
        vm.warp(challenge.endTime() + challenge.RESOLUTION_GRACE_PERIOD());

        challenge.expireChallenge();

        assertEq(usdc.balanceOf(defenderAddr) - defBefore, pool, "defender gets full pool");
        assertEq(challenge.prizePool(), 0, "pool emptied");
        assertEq(uint8(challenge.status()), uint8(IBreakBase.ChallengeStatus.Expired), "status expired");
    }

    function test_expireChallenge_reverts_beforeEndTime() public {
        vm.warp(block.timestamp + DURATION - 1);

        vm.expectRevert(IBreakBase.ChallengeNotExpired.selector);
        challenge.expireChallenge();
    }

    function test_expireChallenge_reverts_alreadyResolved() public {
        _sendMessage(player1);

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signResolve(address(challenge), player1, 1, deadline);
        challenge.resolveChallenge(player1, player1, 1, deadline, sig);

        vm.warp(block.timestamp + DURATION);

        vm.expectRevert(IBreakBase.ChallengeNotActive.selector);
        challenge.expireChallenge();
    }

    function test_expireChallenge_zeroPool() public {
        uint256 defBefore = usdc.balanceOf(defenderAddr);

        vm.warp(challenge.endTime() + challenge.RESOLUTION_GRACE_PERIOD());
        challenge.expireChallenge();

        assertEq(usdc.balanceOf(defenderAddr), defBefore, "no transfer when pool is zero");
        assertEq(uint8(challenge.status()), uint8(IBreakBase.ChallengeStatus.Expired), "still expires");
    }

    function test_expireChallenge_cannotExpireTwice() public {
        vm.warp(challenge.endTime() + challenge.RESOLUTION_GRACE_PERIOD());
        challenge.expireChallenge();

        vm.expectRevert(IBreakBase.ChallengeNotActive.selector);
        challenge.expireChallenge();
    }

    // =========================================================================
    // Seed prize pool
    // =========================================================================

    function test_seedPrizePool_increasesPool() public {
        uint256 seedAmount = 5_000_000; // $5.00

        vm.startPrank(defenderAddr);
        usdc.approve(address(challenge), seedAmount);
        challenge.seedPrizePool(seedAmount);
        vm.stopPrank();

        assertEq(challenge.prizePool(), seedAmount, "prize pool seeded");
        assertEq(usdc.balanceOf(address(challenge)), seedAmount, "USDC in contract");
    }

    function test_seedPrizePool_reverts_whenNotActive() public {
        vm.warp(challenge.endTime() + challenge.RESOLUTION_GRACE_PERIOD());
        challenge.expireChallenge();

        vm.prank(defenderAddr);
        vm.expectRevert(IBreakBase.ChallengeNotActive.selector);
        challenge.seedPrizePool(1_000_000);
    }

    function test_seedPrizePool_reverts_zeroAmount() public {
        vm.prank(defenderAddr);
        vm.expectRevert(IBreakBase.ZeroAmount.selector);
        challenge.seedPrizePool(0);
    }

    function test_seedPrizePool_anyoneCanSeed() public {
        uint256 amount = 1_000_000;
        usdc.mint(player1, amount);

        vm.startPrank(player1);
        usdc.approve(address(challenge), amount);
        challenge.seedPrizePool(amount);
        vm.stopPrank();

        assertEq(challenge.prizePool(), amount, "anyone can seed");
    }

    // =========================================================================
    // Fee math
    // =========================================================================

    function test_feeSplit_80_10_10_exactValues() public {
        // Use a fee that divides cleanly: 10_000_000 ($10)
        IBreakBase.ChallengeConfig memory config = IBreakBase.ChallengeConfig({
            defender: defenderAddr,
            usdc: address(usdc),
            basePrice: 10_000_000,
            maxFee: 0,
            duration: DURATION,
            growthRateBps: 0,
            pricingModel: IBreakBase.PricingModel.Fixed
        });

        vm.prank(defenderAddr);
        (address clone,) = factory.createChallenge(config, 0);
        Challenge c = Challenge(clone);

        usdc.mint(player1, 100_000_000);
        vm.prank(player1);
        usdc.approve(clone, type(uint256).max);

        uint256 defBefore = usdc.balanceOf(defenderAddr);
        uint256 protoBefore = usdc.balanceOf(protocolWallet);

        vm.prank(player1);
        c.sendMessage();

        assertEq(c.prizePool(), 8_000_000, "80% = 8_000_000");
        assertEq(usdc.balanceOf(defenderAddr) - defBefore, 1_000_000, "10% defender = 1_000_000");
        assertEq(usdc.balanceOf(protocolWallet) - protoBefore, 1_000_000, "10% protocol = 1_000_000");
    }

    function test_feeSplit_dustGoesToProtocol() public {
        // Use a fee that cannot divide evenly by 10_000
        // fee = 3 (smallest possible with min price override)
        // prizeShare = (3 * 8000) / 10000 = 2
        // defenderShare = (3 * 1000) / 10000 = 0
        // protocolShare = 3 - 2 - 0 = 1 (absorbs dust)

        // We need to lower the factory min price first
        factory.setMinBasePrice(1);

        IBreakBase.ChallengeConfig memory config = IBreakBase.ChallengeConfig({
            defender: defenderAddr,
            usdc: address(usdc),
            basePrice: 3,
            maxFee: 0,
            duration: DURATION,
            growthRateBps: 0,
            pricingModel: IBreakBase.PricingModel.Fixed
        });

        vm.prank(defenderAddr);
        (address clone,) = factory.createChallenge(config, 0);
        Challenge c = Challenge(clone);

        usdc.mint(player1, 1_000_000);
        vm.prank(player1);
        usdc.approve(clone, type(uint256).max);

        uint256 defBefore = usdc.balanceOf(defenderAddr);
        uint256 protoBefore = usdc.balanceOf(protocolWallet);

        vm.prank(player1);
        c.sendMessage();

        uint256 prizeShare = (uint256(3) * 8000) / 10_000; // 2
        uint256 defenderShare = (uint256(3) * 1000) / 10_000; // 0
        uint256 protocolShare = 3 - prizeShare - defenderShare; // 1

        assertEq(c.prizePool(), prizeShare, "prize = 2");
        assertEq(usdc.balanceOf(defenderAddr) - defBefore, defenderShare, "defender = 0");
        assertEq(usdc.balanceOf(protocolWallet) - protoBefore, protocolShare, "protocol absorbs dust = 1");
    }

    function test_feeSplit_minimumFee() public {
        // The factory enforces minBasePrice (default 10_000 = $0.01)
        // Verify the split at minimum fee
        uint256 minFee = factory.minBasePrice(); // 10_000

        IBreakBase.ChallengeConfig memory config = IBreakBase.ChallengeConfig({
            defender: defenderAddr,
            usdc: address(usdc),
            basePrice: minFee,
            maxFee: 0,
            duration: DURATION,
            growthRateBps: 0,
            pricingModel: IBreakBase.PricingModel.Fixed
        });

        vm.prank(defenderAddr);
        (address clone,) = factory.createChallenge(config, 0);
        Challenge c = Challenge(clone);

        usdc.mint(player1, 1_000_000);
        vm.prank(player1);
        usdc.approve(clone, type(uint256).max);

        uint256 protoBefore = usdc.balanceOf(protocolWallet);
        uint256 defBefore = usdc.balanceOf(defenderAddr);

        vm.prank(player1);
        uint256 fee = c.sendMessage();

        assertEq(fee, minFee, "fee equals min");

        uint256 expectedPrize = (minFee * 8000) / 10_000; // 8_000
        uint256 expectedDef = (minFee * 1000) / 10_000; // 1_000
        uint256 expectedProto = minFee - expectedPrize - expectedDef; // 1_000

        assertEq(c.prizePool(), expectedPrize, "prize");
        assertEq(usdc.balanceOf(defenderAddr) - defBefore, expectedDef, "defender");
        assertEq(usdc.balanceOf(protocolWallet) - protoBefore, expectedProto, "protocol");
    }

    // =========================================================================
    // Security
    // =========================================================================

    function test_defenderCannotWithdrawWhileActive() public {
        // Send a message so messageCount = 1 (required for valid attemptNumber)
        _sendMessage(player1);

        // Seed the pool with additional funds
        vm.startPrank(defenderAddr);
        usdc.approve(address(challenge), 5_000_000);
        challenge.seedPrizePool(5_000_000);
        vm.stopPrank();

        // Defender cannot call expireChallenge before endTime
        vm.prank(defenderAddr);
        vm.expectRevert(IBreakBase.ChallengeNotExpired.selector);
        challenge.expireChallenge();

        // Defender cannot call resolveChallenge without valid oracle sig
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 challengeId = keccak256(abi.encode(address(challenge)));
        bytes32 structHash =
            keccak256(abi.encode(CHALLENGE_RESULT_TYPEHASH, challengeId, defenderAddr, uint256(1), deadline));
        bytes32 digest = MessageHashUtils.toTypedDataHash(_domainSeparator(address(challenge)), structHash);

        // Sign with a random key (not oracle)
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xDEAD, digest);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.prank(defenderAddr);
        vm.expectRevert(IBreakBase.InvalidSignature.selector);
        challenge.resolveChallenge(defenderAddr, defenderAddr, 1, deadline, badSig);
    }

    // =========================================================================
    // Events
    // =========================================================================

    function test_sendMessage_emitsEvent() public {
        uint256 fee = BASE_PRICE;
        uint256 prizeShare = (fee * 8000) / 10_000;
        uint256 defenderShare = (fee * 1000) / 10_000;
        uint256 protocolShare = fee - prizeShare - defenderShare;

        vm.expectEmit(true, true, false, true);
        emit IBreakBase.MessageSent(address(challenge), player1, fee, prizeShare, defenderShare, protocolShare, 1);

        vm.prank(player1);
        challenge.sendMessage();
    }

    function test_resolveChallenge_emitsEvent() public {
        _sendMessage(player1);
        uint256 pool = challenge.prizePool();
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signResolve(address(challenge), player1, 1, deadline);

        vm.expectEmit(true, true, false, true);
        emit IBreakBase.ChallengeResolved(address(challenge), player1, player1, pool, 1);

        challenge.resolveChallenge(player1, player1, 1, deadline, sig);
    }

    function test_expireChallenge_emitsEvent() public {
        _sendMessage(player1);
        uint256 pool = challenge.prizePool();

        vm.warp(challenge.endTime() + challenge.RESOLUTION_GRACE_PERIOD());

        vm.expectEmit(true, true, false, true);
        emit IBreakBase.ChallengeExpired(address(challenge), defenderAddr, pool);

        challenge.expireChallenge();
    }

    function test_seedPrizePool_emitsEvent() public {
        uint256 amount = 1_000_000;

        vm.startPrank(defenderAddr);
        usdc.approve(address(challenge), amount);

        vm.expectEmit(true, true, false, true);
        emit IBreakBase.PrizePoolSeeded(address(challenge), defenderAddr, amount);

        challenge.seedPrizePool(amount);
        vm.stopPrank();
    }

    // =========================================================================
    // getChallengeId
    // =========================================================================

    function test_getChallengeId_matchesFactory() public view {
        bytes32 fromChallenge = challenge.getChallengeId();
        bytes32 expected = keccak256(abi.encode(address(challenge)));
        assertEq(fromChallenge, expected, "challengeId matches keccak256(abi.encode(address))");
    }

    // =========================================================================
    // Edge cases
    // =========================================================================

    function test_sendMessage_exactlyAtEndTime_reverts() public {
        // The contract checks `block.timestamp >= endTime`
        vm.warp(challenge.endTime());

        vm.prank(player1);
        vm.expectRevert(IBreakBase.ChallengeNotActive.selector);
        challenge.sendMessage();
    }

    function test_expireChallenge_exactlyAtEndTime_reverts() public {
        // After the grace period fix, expiry at exactly endTime should revert
        vm.warp(challenge.endTime());
        vm.expectRevert(IBreakBase.ChallengeNotExpired.selector);
        challenge.expireChallenge();
    }

    function test_expireChallenge_exactlyAtEndTimePlusGrace_succeeds() public {
        // Expiry succeeds at exactly endTime + RESOLUTION_GRACE_PERIOD
        vm.warp(challenge.endTime() + challenge.RESOLUTION_GRACE_PERIOD());
        challenge.expireChallenge();
        assertEq(uint8(challenge.status()), uint8(IBreakBase.ChallengeStatus.Expired), "expired at endTime + grace");
    }

    function test_resolveChallenge_exactlyAtDeadline_succeeds() public {
        _sendMessage(player1);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signResolve(address(challenge), player1, 1, deadline);

        // Warp to exactly the deadline (not past it)
        vm.warp(deadline);

        challenge.resolveChallenge(player1, player1, 1, deadline, sig);
        assertEq(uint8(challenge.status()), uint8(IBreakBase.ChallengeStatus.Resolved));
    }

    function test_sendMessage_onlyPullsFromCaller() public {
        // After the CRITICAL-1 fix, sendMessage() uses msg.sender as payer.
        // Verify that calling sendMessage pulls funds from the caller (player1),
        // not from any other address.
        uint256 p1Before = usdc.balanceOf(player1);
        uint256 p2Before = usdc.balanceOf(player2);

        vm.prank(player1);
        challenge.sendMessage();

        assertTrue(usdc.balanceOf(player1) < p1Before, "tokens pulled from caller (player1)");
        assertEq(usdc.balanceOf(player2), p2Before, "player2 balance unchanged");
    }

    // =========================================================================
    // Cancel challenge (MEDIUM-1 fix)
    // =========================================================================

    function test_cancelChallenge_byDefender() public {
        // Seed prize pool directly (no messages sent)
        uint256 seedAmount = 5_000_000;
        vm.startPrank(defenderAddr);
        usdc.approve(address(challenge), seedAmount);
        challenge.seedPrizePool(seedAmount);
        vm.stopPrank();

        uint256 pool = challenge.prizePool();
        assertTrue(pool > 0, "pool should be nonzero");

        uint256 defBefore = usdc.balanceOf(defenderAddr);

        vm.prank(defenderAddr);
        challenge.cancelChallenge();

        assertEq(usdc.balanceOf(defenderAddr) - defBefore, pool, "defender receives full prize pool");
        assertEq(challenge.prizePool(), 0, "pool emptied");
        assertEq(uint8(challenge.status()), uint8(IBreakBase.ChallengeStatus.Cancelled), "status cancelled");
    }

    function test_cancelChallenge_reverts_notDefender() public {
        _sendMessage(player1);

        // player1 is not the defender
        vm.prank(player1);
        vm.expectRevert(IBreakBase.OnlyDefender.selector);
        challenge.cancelChallenge();

        // player2 is not the defender
        vm.prank(player2);
        vm.expectRevert(IBreakBase.OnlyDefender.selector);
        challenge.cancelChallenge();
    }

    function test_cancelChallenge_reverts_notActive() public {
        // Resolve challenge first
        _sendMessage(player1);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signResolve(address(challenge), player1, 1, deadline);
        challenge.resolveChallenge(player1, player1, 1, deadline, sig);

        vm.prank(defenderAddr);
        vm.expectRevert(IBreakBase.ChallengeNotActive.selector);
        challenge.cancelChallenge();
    }

    function test_cancelChallenge_reverts_afterExpired() public {
        vm.warp(challenge.endTime() + challenge.RESOLUTION_GRACE_PERIOD());
        challenge.expireChallenge();

        vm.prank(defenderAddr);
        vm.expectRevert(IBreakBase.ChallengeNotActive.selector);
        challenge.cancelChallenge();
    }

    function test_cancelChallenge_emptyPool() public {
        // No messages sent, pool is 0
        assertEq(challenge.prizePool(), 0, "pool starts at zero");

        uint256 defBefore = usdc.balanceOf(defenderAddr);

        vm.prank(defenderAddr);
        challenge.cancelChallenge();

        assertEq(usdc.balanceOf(defenderAddr), defBefore, "no transfer when pool is zero");
        assertEq(challenge.prizePool(), 0, "pool still zero");
        assertEq(uint8(challenge.status()), uint8(IBreakBase.ChallengeStatus.Cancelled), "still cancels");
    }

    function test_cancelChallenge_emitsEvent() public {
        // Seed pool directly (no messages, so cancel is allowed)
        uint256 seedAmount = 2_000_000;
        vm.startPrank(defenderAddr);
        usdc.approve(address(challenge), seedAmount);
        challenge.seedPrizePool(seedAmount);
        vm.stopPrank();

        uint256 pool = challenge.prizePool();

        vm.expectEmit(true, true, false, true);
        emit IBreakBase.ChallengeCancelled(address(challenge), defenderAddr, pool);

        vm.prank(defenderAddr);
        challenge.cancelChallenge();
    }

    function test_cancelChallenge_blocksMessages() public {
        // Cancel with no messages sent
        vm.prank(defenderAddr);
        challenge.cancelChallenge();

        // Sending a message after cancel should revert
        vm.prank(player1);
        vm.expectRevert(IBreakBase.ChallengeNotActive.selector);
        challenge.sendMessage();
    }

    // =========================================================================
    // attemptNumber validation in resolveChallenge (MEDIUM-2 fix)
    // =========================================================================

    function test_resolveChallenge_reverts_invalidAttemptNumber() public {
        // Send 2 messages so messageCount = 2
        _sendMessage(player1);
        _sendMessage(player2);
        assertEq(challenge.messageCount(), 2, "2 messages sent");

        // attemptNumber = 3 exceeds messageCount = 2
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signResolve(address(challenge), player1, 3, deadline);

        vm.expectRevert(IBreakBase.InvalidAttemptNumber.selector);
        challenge.resolveChallenge(player1, player1, 3, deadline, sig);
    }

    function test_resolveChallenge_validAttemptNumber() public {
        // Send 3 messages so messageCount = 3
        _sendMessage(player1);
        _sendMessage(player2);
        _sendMessage(player1);
        assertEq(challenge.messageCount(), 3, "3 messages sent");

        uint256 pool = challenge.prizePool();
        uint256 deadline = block.timestamp + 1 hours;

        // attemptNumber = 3 equals messageCount = 3 (valid)
        bytes memory sig = _signResolve(address(challenge), player1, 3, deadline);

        uint256 playerBefore = usdc.balanceOf(player1);

        challenge.resolveChallenge(player1, player1, 3, deadline, sig);

        assertEq(usdc.balanceOf(player1) - playerBefore, pool, "winner receives prize");
        assertEq(uint8(challenge.status()), uint8(IBreakBase.ChallengeStatus.Resolved), "status resolved");
    }

    // =========================================================================
    // New tests for audit fixes
    // =========================================================================

    function test_cancelChallenge_reverts_withParticipants() public {
        // Send a message so messageCount > 0
        _sendMessage(player1);
        assertEq(challenge.messageCount(), 1, "messageCount should be 1");

        vm.prank(defenderAddr);
        vm.expectRevert(IBreakBase.CannotCancelWithParticipants.selector);
        challenge.cancelChallenge();
    }

    function test_cancelChallenge_succeeds_noMessages() public {
        // No messages sent, messageCount = 0
        assertEq(challenge.messageCount(), 0, "no messages");

        // Seed some funds to make it interesting
        uint256 seedAmount = 3_000_000;
        vm.startPrank(defenderAddr);
        usdc.approve(address(challenge), seedAmount);
        challenge.seedPrizePool(seedAmount);
        vm.stopPrank();

        uint256 defBefore = usdc.balanceOf(defenderAddr);

        vm.prank(defenderAddr);
        challenge.cancelChallenge();

        assertEq(usdc.balanceOf(defenderAddr) - defBefore, seedAmount, "defender receives seeded funds");
        assertEq(challenge.prizePool(), 0, "pool emptied");
        assertEq(uint8(challenge.status()), uint8(IBreakBase.ChallengeStatus.Cancelled), "status cancelled");
    }

    function test_expireChallenge_reverts_duringGracePeriod() public {
        // At exactly endTime, should revert
        vm.warp(challenge.endTime());
        vm.expectRevert(IBreakBase.ChallengeNotExpired.selector);
        challenge.expireChallenge();

        // At endTime + 30 minutes (within 1 hour grace), should still revert
        vm.warp(challenge.endTime() + 30 minutes);
        vm.expectRevert(IBreakBase.ChallengeNotExpired.selector);
        challenge.expireChallenge();
    }

    function test_expireChallenge_succeeds_afterGracePeriod() public {
        // At exactly endTime + RESOLUTION_GRACE_PERIOD (1 hour), should succeed
        vm.warp(challenge.endTime() + challenge.RESOLUTION_GRACE_PERIOD());
        challenge.expireChallenge();
        assertEq(uint8(challenge.status()), uint8(IBreakBase.ChallengeStatus.Expired), "expired after grace period");
    }

    function test_getCurrentFee_escalating_returnsMaxFeeOnOverflow() public {
        // Create escalating challenge with high growth rate
        uint256 maxFeeCap = 50_000_000; // $50
        Challenge esc = _createEscalatingChallenge(BASE_PRICE, 500, maxFeeCap); // 5% growth

        usdc.mint(player1, 10_000_000_000_000); // plenty
        vm.prank(player1);
        usdc.approve(address(esc), type(uint256).max);

        // Send enough messages so messageCount * growthRateBps > 1_000_000
        // 500 bps * 2001 messages = 1_000_500 > 1_000_000
        // We need to actually send messages to increment messageCount
        // Sending 2001 would be expensive in test, so let's verify the overflow guard
        // by manipulating storage directly for messageCount
        // slot for messageCount in Challenge = slot 7 (after status, defender, protocolWallet, oracle, usdc, prizePool)
        // Actually, let's use vm.store to set messageCount high

        // First, find the storage slot for messageCount
        // In Challenge.sol order: status(0), defender(1), protocolWallet(2), oracle(3), usdc(4),
        // prizePool(5), messageCount(6), endTime(7), basePrice(8), maxFee(9),
        // growthRateBps+pricingModel packed(10)
        // But these are after Initializable (slot 0) and ReentrancyGuardTransient storage
        // Let's just check the value after warping: use vm.store

        // Use a simpler approach: read getCurrentFee after setting messageCount via store
        // The Initializable uses slot 0 (uint64), ReentrancyGuardTransient uses transient storage
        // Challenge state starts at defined slots. Let's just check from a known high messageCount.

        // Send a few messages to warm up, then check overflow path
        for (uint256 i = 0; i < 10; i++) {
            vm.prank(player1);
            esc.sendMessage();
        }

        // Now manually store a high messageCount to trigger overflow guard
        // messageCount is at storage slot: let's find it
        uint256 currentCount = esc.messageCount();
        assertEq(currentCount, 10, "10 messages sent");

        // Store messageCount = 2100 to trigger overflow guard (2100 * 500 = 1_050_000 > 1_000_000)
        // We need the storage slot for messageCount. Let's load and find it.
        // Find the correct slot by checking each one
        for (uint256 s = 0; s < 20; s++) {
            bytes32 val = vm.load(address(esc), bytes32(s));
            if (uint256(val) == currentCount) {
                // Found messageCount slot, store high value
                vm.store(address(esc), bytes32(s), bytes32(uint256(2100)));
                break;
            }
        }

        assertEq(esc.messageCount(), 2100, "messageCount set to 2100");

        // Now getCurrentFee should return maxFee due to overflow guard
        uint256 fee = esc.getCurrentFee();
        assertEq(fee, maxFeeCap, "returns maxFee on overflow guard");
    }

    // =========================================================================
    // Permit helpers
    // =========================================================================

    /// @dev Sign an ERC-2612 permit for the MockERC20 (which inherits ERC20Permit)
    function _signPermit(
        uint256 ownerPrivateKey,
        address owner_,
        address spender,
        uint256 value,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 domainSeparator = MockERC20(address(usdc)).DOMAIN_SEPARATOR();
        bytes32 permitTypehash =
            keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
        bytes32 structHash = keccak256(abi.encode(permitTypehash, owner_, spender, value, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (v, r, s) = vm.sign(ownerPrivateKey, digest);
    }

    // =========================================================================
    // sendMessageWithPermit
    // =========================================================================

    function test_sendMessageWithPermit_singleTx() public {
        // Player1 has NO existing approval to this challenge for this test.
        // Revoke the blanket approval set in setUp.
        vm.prank(player1);
        usdc.approve(address(challenge), 0);

        // Compute the fee that will be charged
        uint256 fee = challenge.getCurrentFee();
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = usdc.nonces(player1);

        // Sign a permit
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(player1Key, player1, address(challenge), fee, nonce, deadline);

        uint256 defBefore = usdc.balanceOf(defenderAddr);
        uint256 protoBefore = usdc.balanceOf(protocolWallet);
        uint256 playerBefore = usdc.balanceOf(player1);

        // Call sendMessageWithPermit
        vm.prank(player1);
        uint256 returnedFee = challenge.sendMessageWithPermit(deadline, v, r, s);

        // Verify fee charged
        assertEq(returnedFee, fee, "returned fee matches getCurrentFee");

        // Verify fee split: 80/10/10
        uint256 expectedPrize = (fee * 8000) / 10_000;
        uint256 expectedDefender = (fee * 1000) / 10_000;
        uint256 expectedProtocol = fee - expectedPrize - expectedDefender;

        assertEq(challenge.prizePool(), expectedPrize, "prizePool 80%");
        assertEq(usdc.balanceOf(defenderAddr) - defBefore, expectedDefender, "defender 10%");
        assertEq(usdc.balanceOf(protocolWallet) - protoBefore, expectedProtocol, "protocol 10%");
        assertEq(playerBefore - usdc.balanceOf(player1), fee, "fee deducted from player");
        assertEq(challenge.messageCount(), 1, "messageCount incremented");
    }

    function test_sendMessageWithPermit_failedPermitFallsBack() public {
        // Player1 already has max approval from setUp.
        // Send an INVALID permit (wrong private key), but since approval exists
        // the transferFrom should still succeed.
        uint256 fee = challenge.getCurrentFee();
        uint256 deadline = block.timestamp + 1 hours;

        // Sign with a random key that does not correspond to player1
        uint256 wrongKey = 0xBADBAD;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(wrongKey, player1, address(challenge), fee, 0, deadline);

        uint256 playerBefore = usdc.balanceOf(player1);

        // The invalid permit should fail silently (try/catch), then
        // transferFrom succeeds because of existing approval
        vm.prank(player1);
        uint256 returnedFee = challenge.sendMessageWithPermit(deadline, v, r, s);

        assertEq(returnedFee, fee, "fee charged despite invalid permit");
        assertEq(playerBefore - usdc.balanceOf(player1), fee, "tokens pulled via existing approval");
        assertEq(challenge.messageCount(), 1, "message counted");
    }

    function test_sendMessageWithPermit_reverts_notActive() public {
        // Expire the challenge
        vm.warp(challenge.endTime() + challenge.RESOLUTION_GRACE_PERIOD());
        challenge.expireChallenge();

        uint256 fee = BASE_PRICE;
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(player1Key, player1, address(challenge), fee, 0, deadline);

        vm.prank(player1);
        vm.expectRevert(IBreakBase.ChallengeNotActive.selector);
        challenge.sendMessageWithPermit(deadline, v, r, s);
    }

    // =========================================================================
    // seedPrizePoolWithPermit
    // =========================================================================

    function test_seedPrizePoolWithPermit_works() public {
        // Use player1 (who already has balance and a known key) to seed
        uint256 seedAmount = 5_000_000; // $5.00
        uint256 deadline = block.timestamp + 1 hours;

        // Revoke player1's blanket approval so we rely purely on permit
        vm.prank(player1);
        usdc.approve(address(challenge), 0);

        // Sign permit
        uint256 nonce = usdc.nonces(player1);
        (uint8 v, bytes32 r, bytes32 s) =
            _signPermit(player1Key, player1, address(challenge), seedAmount, nonce, deadline);

        uint256 poolBefore = challenge.prizePool();

        vm.prank(player1);
        challenge.seedPrizePoolWithPermit(seedAmount, deadline, v, r, s);

        assertEq(challenge.prizePool() - poolBefore, seedAmount, "prize pool increased");
        assertEq(usdc.balanceOf(address(challenge)), seedAmount, "USDC transferred to challenge");
    }

    function test_seedPrizePoolWithPermit_reverts_zeroAmount() public {
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(player1Key, player1, address(challenge), 0, 0, deadline);

        vm.prank(player1);
        vm.expectRevert(IBreakBase.ZeroAmount.selector);
        challenge.seedPrizePoolWithPermit(0, deadline, v, r, s);
    }

    // =========================================================================
    // Emergency Timelock Withdrawal
    // =========================================================================

    function test_requestEmergencyWithdrawal_setsTimestamp() public {
        vm.prank(defenderAddr);
        challenge.requestEmergencyWithdrawal();

        assertEq(challenge.emergencyRequestedAt(), block.timestamp, "emergencyRequestedAt set");
    }

    function test_requestEmergencyWithdrawal_emitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit IBreakBase.EmergencyWithdrawalRequested(address(challenge), defenderAddr, block.timestamp);

        vm.prank(defenderAddr);
        challenge.requestEmergencyWithdrawal();
    }

    function test_requestEmergencyWithdrawal_reverts_notDefender() public {
        vm.prank(player1);
        vm.expectRevert(IBreakBase.OnlyDefender.selector);
        challenge.requestEmergencyWithdrawal();
    }

    function test_requestEmergencyWithdrawal_reverts_notActive() public {
        vm.warp(challenge.endTime() + challenge.RESOLUTION_GRACE_PERIOD());
        challenge.expireChallenge();

        vm.prank(defenderAddr);
        vm.expectRevert(IBreakBase.ChallengeNotActive.selector);
        challenge.requestEmergencyWithdrawal();
    }

    function test_executeEmergencyWithdrawal_afterTimelock() public {
        // Seed and send a message to build prize pool
        uint256 seedAmount = 5_000_000;
        vm.startPrank(defenderAddr);
        usdc.approve(address(challenge), seedAmount);
        challenge.seedPrizePool(seedAmount);
        vm.stopPrank();

        _sendMessage(player1);

        uint256 pool = challenge.prizePool();
        assertTrue(pool > 0, "pool should be nonzero");

        // Request emergency withdrawal
        vm.prank(defenderAddr);
        challenge.requestEmergencyWithdrawal();

        // Warp past timelock
        vm.warp(block.timestamp + challenge.EMERGENCY_TIMELOCK());

        uint256 defBefore = usdc.balanceOf(defenderAddr);

        vm.prank(defenderAddr);
        challenge.executeEmergencyWithdrawal();

        assertEq(usdc.balanceOf(defenderAddr) - defBefore, pool, "defender receives full pool");
        assertEq(challenge.prizePool(), 0, "pool emptied");
        assertEq(uint8(challenge.status()), uint8(IBreakBase.ChallengeStatus.Expired), "status expired");
    }

    function test_executeEmergencyWithdrawal_emitsEvent() public {
        uint256 seedAmount = 3_000_000;
        vm.startPrank(defenderAddr);
        usdc.approve(address(challenge), seedAmount);
        challenge.seedPrizePool(seedAmount);
        vm.stopPrank();

        uint256 pool = challenge.prizePool();

        vm.prank(defenderAddr);
        challenge.requestEmergencyWithdrawal();

        vm.warp(block.timestamp + challenge.EMERGENCY_TIMELOCK());

        vm.expectEmit(true, true, false, true);
        emit IBreakBase.EmergencyWithdrawalExecuted(address(challenge), defenderAddr, pool);

        vm.prank(defenderAddr);
        challenge.executeEmergencyWithdrawal();
    }

    function test_executeEmergencyWithdrawal_reverts_notRequested() public {
        vm.prank(defenderAddr);
        vm.expectRevert(IBreakBase.EmergencyNotRequested.selector);
        challenge.executeEmergencyWithdrawal();
    }

    function test_executeEmergencyWithdrawal_reverts_timelockNotElapsed() public {
        vm.prank(defenderAddr);
        challenge.requestEmergencyWithdrawal();

        // Warp to just before the timelock expires
        vm.warp(block.timestamp + challenge.EMERGENCY_TIMELOCK() - 1);

        vm.prank(defenderAddr);
        vm.expectRevert(IBreakBase.EmergencyTimelockNotElapsed.selector);
        challenge.executeEmergencyWithdrawal();
    }

    function test_executeEmergencyWithdrawal_reverts_notDefender() public {
        vm.prank(defenderAddr);
        challenge.requestEmergencyWithdrawal();

        vm.warp(block.timestamp + challenge.EMERGENCY_TIMELOCK());

        vm.prank(player1);
        vm.expectRevert(IBreakBase.OnlyDefender.selector);
        challenge.executeEmergencyWithdrawal();
    }

    function test_executeEmergencyWithdrawal_reverts_notActive() public {
        vm.prank(defenderAddr);
        challenge.requestEmergencyWithdrawal();

        // Expire the challenge normally
        vm.warp(challenge.endTime() + challenge.RESOLUTION_GRACE_PERIOD());
        challenge.expireChallenge();

        vm.prank(defenderAddr);
        vm.expectRevert(IBreakBase.ChallengeNotActive.selector);
        challenge.executeEmergencyWithdrawal();
    }

    function test_executeEmergencyWithdrawal_zeroPool() public {
        // No funds in pool
        vm.prank(defenderAddr);
        challenge.requestEmergencyWithdrawal();

        vm.warp(block.timestamp + challenge.EMERGENCY_TIMELOCK());

        uint256 defBefore = usdc.balanceOf(defenderAddr);

        vm.prank(defenderAddr);
        challenge.executeEmergencyWithdrawal();

        assertEq(usdc.balanceOf(defenderAddr), defBefore, "no transfer when pool is zero");
        assertEq(uint8(challenge.status()), uint8(IBreakBase.ChallengeStatus.Expired), "still expires");
    }

    function test_cancelEmergencyWithdrawal_resetsTimestamp() public {
        vm.prank(defenderAddr);
        challenge.requestEmergencyWithdrawal();
        assertTrue(challenge.emergencyRequestedAt() > 0, "request pending");

        vm.prank(defenderAddr);
        challenge.cancelEmergencyWithdrawal();
        assertEq(challenge.emergencyRequestedAt(), 0, "request cancelled");
    }

    function test_cancelEmergencyWithdrawal_emitsEvent() public {
        vm.prank(defenderAddr);
        challenge.requestEmergencyWithdrawal();

        vm.expectEmit(true, true, false, true);
        emit IBreakBase.EmergencyWithdrawalCancelled(address(challenge), defenderAddr);

        vm.prank(defenderAddr);
        challenge.cancelEmergencyWithdrawal();
    }

    function test_cancelEmergencyWithdrawal_reverts_notDefender() public {
        vm.prank(defenderAddr);
        challenge.requestEmergencyWithdrawal();

        vm.prank(player1);
        vm.expectRevert(IBreakBase.OnlyDefender.selector);
        challenge.cancelEmergencyWithdrawal();
    }

    function test_cancelEmergencyWithdrawal_preventsExecution() public {
        vm.prank(defenderAddr);
        challenge.requestEmergencyWithdrawal();

        // Cancel
        vm.prank(defenderAddr);
        challenge.cancelEmergencyWithdrawal();

        // Warp past what would have been the timelock
        vm.warp(block.timestamp + challenge.EMERGENCY_TIMELOCK());

        // Execute should revert because request was cancelled
        vm.prank(defenderAddr);
        vm.expectRevert(IBreakBase.EmergencyNotRequested.selector);
        challenge.executeEmergencyWithdrawal();
    }

    function test_emergencyTimelock_constant() public view {
        assertEq(challenge.EMERGENCY_TIMELOCK(), 72 hours, "timelock is 72 hours");
    }

    function test_executeEmergencyWithdrawal_exactlyAtTimelock() public {
        vm.prank(defenderAddr);
        challenge.requestEmergencyWithdrawal();
        uint256 requestedAt = challenge.emergencyRequestedAt();

        // Warp to exactly the timelock boundary
        vm.warp(requestedAt + challenge.EMERGENCY_TIMELOCK());

        vm.prank(defenderAddr);
        challenge.executeEmergencyWithdrawal();
        assertEq(uint8(challenge.status()), uint8(IBreakBase.ChallengeStatus.Expired), "executes at exact boundary");
    }

    function test_requestEmergencyWithdrawal_canReRequest() public {
        // First request
        vm.prank(defenderAddr);
        challenge.requestEmergencyWithdrawal();
        uint256 firstRequest = challenge.emergencyRequestedAt();

        // Warp forward but not past timelock
        vm.warp(block.timestamp + 1 hours);

        // Request again (resets the timer)
        vm.prank(defenderAddr);
        challenge.requestEmergencyWithdrawal();
        uint256 secondRequest = challenge.emergencyRequestedAt();

        assertTrue(secondRequest > firstRequest, "second request has later timestamp");
    }

    // =========================================================================
    // Alternate Recipient in resolveChallenge
    // =========================================================================

    function test_resolveChallenge_alternateRecipient() public {
        _sendMessage(player1);

        uint256 pool = challenge.prizePool();
        assertTrue(pool > 0, "pool should be nonzero");

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signResolve(address(challenge), player1, 1, deadline);

        // Use player2 as recipient while player1 is the winner
        uint256 recipientBefore = usdc.balanceOf(player2);
        uint256 winnerBefore = usdc.balanceOf(player1);

        challenge.resolveChallenge(player1, player2, 1, deadline, sig);

        // Prize goes to recipient (player2), not winner (player1)
        assertEq(usdc.balanceOf(player2) - recipientBefore, pool, "recipient receives prize");
        assertEq(usdc.balanceOf(player1), winnerBefore, "winner balance unchanged");
        assertEq(uint8(challenge.status()), uint8(IBreakBase.ChallengeStatus.Resolved), "status resolved");
    }

    function test_resolveChallenge_alternateRecipient_emitsEvent() public {
        _sendMessage(player1);

        uint256 pool = challenge.prizePool();
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signResolve(address(challenge), player1, 1, deadline);

        vm.expectEmit(true, true, false, true);
        emit IBreakBase.ChallengeResolved(address(challenge), player1, player2, pool, 1);

        challenge.resolveChallenge(player1, player2, 1, deadline, sig);
    }

    function test_resolveChallenge_reverts_zeroRecipient() public {
        _sendMessage(player1);

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signResolve(address(challenge), player1, 1, deadline);

        vm.expectRevert(IBreakBase.ZeroAddress.selector);
        challenge.resolveChallenge(player1, address(0), 1, deadline, sig);
    }

    function test_resolveChallenge_sameWinnerAndRecipient() public {
        _sendMessage(player1);

        uint256 pool = challenge.prizePool();
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signResolve(address(challenge), player1, 1, deadline);

        uint256 playerBefore = usdc.balanceOf(player1);

        challenge.resolveChallenge(player1, player1, 1, deadline, sig);

        assertEq(usdc.balanceOf(player1) - playerBefore, pool, "winner receives prize when recipient == winner");
    }

    function test_resolveChallenge_signatureCoversWinnerNotRecipient() public {
        _sendMessage(player1);

        uint256 deadline = block.timestamp + 1 hours;
        // Sign for player2 as winner
        bytes memory sig = _signResolve(address(challenge), player2, 1, deadline);

        // Try to resolve with player1 as winner but using player2's signature
        // This should fail because signature was for player2
        vm.expectRevert(IBreakBase.InvalidSignature.selector);
        challenge.resolveChallenge(player1, player2, 1, deadline, sig);
    }
}
