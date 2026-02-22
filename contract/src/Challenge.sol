// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {UD60x18, ud} from "@prb/math/UD60x18.sol";
import {IBreakBase} from "./interfaces/IBreakBase.sol";

contract Challenge is IBreakBase, Initializable, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    bytes32 public constant CHALLENGE_RESULT_TYPEHASH =
        keccak256("ChallengeResult(bytes32 challengeId,address winner,uint256 attemptNumber,uint256 deadline)");
    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant HASHED_NAME = keccak256("BreakBase");
    bytes32 private constant HASHED_VERSION = keccak256("1");
    uint256 public constant FEE_POOL_BPS = 8000;
    uint256 public constant FEE_DEFENDER_BPS = 1000;
    uint256 public constant FEE_PROTOCOL_BPS = 1000;
    uint256 public constant EMERGENCY_TIMELOCK = 72 hours;
    uint256 public constant RESOLUTION_GRACE_PERIOD = 1 hours;
    uint256 private constant BPS_DENOMINATOR = 10_000;
    uint256 private constant USDC_TO_UD60x18 = 1e12;
    
    ChallengeStatus public status;
    IERC20 public usdc;
    PricingModel public pricingModel;
    address public defender;
    address public protocolWallet;
    address public oracle;
    uint256 public prizePool;
    uint256 public messageCount;
    uint256 public endTime;
    uint256 public basePrice;
    uint256 public maxFee;
    uint16 public growthRateBps;
    uint256 public emergencyRequestedAt;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(ChallengeConfig calldata config, address oracle_, address protocolWallet_)
        external
        initializer
    {
        if (config.defender == address(0)) revert ZeroAddress();
        if (config.usdc == address(0)) revert ZeroAddress();
        if (oracle_ == address(0)) revert ZeroAddress();
        if (protocolWallet_ == address(0)) revert ZeroAddress();
        if (config.basePrice == 0) revert InvalidBasePrice();
        if (config.duration == 0) revert InvalidDuration();

        defender = config.defender;
        usdc = IERC20(config.usdc);
        basePrice = config.basePrice;
        maxFee = config.maxFee;
        growthRateBps = config.growthRateBps;
        pricingModel = config.pricingModel;
        oracle = oracle_;
        protocolWallet = protocolWallet_;
        endTime = block.timestamp + uint256(config.duration);
        status = ChallengeStatus.Active;

        emit ChallengeInitialized(
            address(this), config.defender, oracle_, config.basePrice, config.duration, config.pricingModel
        );
    }

    function getCurrentFee() public view returns (uint256) {
        if (pricingModel == PricingModel.Fixed) {
            return basePrice;
        }

        if (maxFee > 0 && uint256(messageCount) * uint256(growthRateBps) > 1_000_000) {
            return maxFee;
        }

        UD60x18 growthFactor = ud(1e18 + uint256(growthRateBps) * 1e14);

        UD60x18 multiplier = growthFactor.powu(messageCount);

        UD60x18 basePriceUd = ud(basePrice * USDC_TO_UD60x18);
        UD60x18 feeUd = basePriceUd * multiplier;

        uint256 fee = feeUd.unwrap() / USDC_TO_UD60x18;

        if (maxFee > 0 && fee > maxFee) {
            return maxFee;
        }
        return fee;
    }

    function sendMessage() external nonReentrant returns (uint256 fee) {
        if (status != ChallengeStatus.Active) revert ChallengeNotActive();
        if (block.timestamp >= endTime) revert ChallengeNotActive();

        fee = getCurrentFee();

        uint256 prizeShare = (fee * FEE_POOL_BPS) / BPS_DENOMINATOR;
        uint256 defenderShare = (fee * FEE_DEFENDER_BPS) / BPS_DENOMINATOR;
        uint256 protocolShare = fee - prizeShare - defenderShare;

        prizePool += prizeShare;
        messageCount++;

        emit MessageSent(address(this), msg.sender, fee, prizeShare, defenderShare, protocolShare, messageCount);

        usdc.safeTransferFrom(msg.sender, address(this), fee);
        usdc.safeTransfer(defender, defenderShare);
        usdc.safeTransfer(protocolWallet, protocolShare);
    }

    function resolveChallenge(
        address winner,
        address recipient,
        uint256 attemptNumber,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant {
        if (status != ChallengeStatus.Active) revert ChallengeNotActive();
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (winner == address(0)) revert ZeroAddress();
        if (recipient == address(0)) revert ZeroAddress();
        if (attemptNumber == 0 || attemptNumber > messageCount) revert InvalidAttemptNumber();

        bytes32 structHash =
            keccak256(abi.encode(CHALLENGE_RESULT_TYPEHASH, getChallengeId(), winner, attemptNumber, deadline));
        bytes32 digest = MessageHashUtils.toTypedDataHash(_domainSeparatorV4(), structHash);

        if (!SignatureChecker.isValidSignatureNow(oracle, digest, signature)) revert InvalidSignature();

        uint256 amount = prizePool;
        prizePool = 0;
        status = ChallengeStatus.Resolved;

        emit ChallengeResolved(address(this), winner, recipient, amount, attemptNumber);

        if (amount > 0) {
            usdc.safeTransfer(recipient, amount);
        }
    }

    function expireChallenge() external nonReentrant {
        if (status != ChallengeStatus.Active) revert ChallengeNotActive();
        if (block.timestamp < endTime + RESOLUTION_GRACE_PERIOD) revert ChallengeNotExpired();

        uint256 amount = prizePool;
        prizePool = 0;
        status = ChallengeStatus.Expired;

        emit ChallengeExpired(address(this), defender, amount);

        if (amount > 0) {
            usdc.safeTransfer(defender, amount);
        }
    }

    function seedPrizePool(uint256 amount) external nonReentrant {
        if (status != ChallengeStatus.Active) revert ChallengeNotActive();
        if (amount == 0) revert ZeroAmount();

        prizePool += amount;

        emit PrizePoolSeeded(address(this), msg.sender, amount);

        usdc.safeTransferFrom(msg.sender, address(this), amount);
    }

    function sendMessageWithPermit(uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external
        nonReentrant
        returns (uint256 fee)
    {
        if (status != ChallengeStatus.Active) revert ChallengeNotActive();
        if (block.timestamp >= endTime) revert ChallengeNotActive();

        fee = getCurrentFee();

        try IERC20Permit(address(usdc)).permit(msg.sender, address(this), fee, deadline, v, r, s) {} catch {}

        uint256 prizeShare = (fee * FEE_POOL_BPS) / BPS_DENOMINATOR;
        uint256 defenderShare = (fee * FEE_DEFENDER_BPS) / BPS_DENOMINATOR;
        uint256 protocolShare = fee - prizeShare - defenderShare;

        prizePool += prizeShare;
        messageCount++;

        emit MessageSent(address(this), msg.sender, fee, prizeShare, defenderShare, protocolShare, messageCount);

        usdc.safeTransferFrom(msg.sender, address(this), fee);
        usdc.safeTransfer(defender, defenderShare);
        usdc.safeTransfer(protocolWallet, protocolShare);
    }

    function seedPrizePoolWithPermit(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external
        nonReentrant
    {
        if (status != ChallengeStatus.Active) revert ChallengeNotActive();
        if (amount == 0) revert ZeroAmount();

        try IERC20Permit(address(usdc)).permit(msg.sender, address(this), amount, deadline, v, r, s) {} catch {}

        prizePool += amount;

        emit PrizePoolSeeded(address(this), msg.sender, amount);

        usdc.safeTransferFrom(msg.sender, address(this), amount);
    }

    function cancelChallenge() external nonReentrant {
        if (msg.sender != defender) revert OnlyDefender();
        if (status != ChallengeStatus.Active) revert ChallengeNotActive();
        if (messageCount > 0) revert CannotCancelWithParticipants();

        uint256 amount = prizePool;
        prizePool = 0;
        status = ChallengeStatus.Cancelled;

        emit ChallengeCancelled(address(this), defender, amount);

        if (amount > 0) {
            usdc.safeTransfer(defender, amount);
        }
    }

    function requestEmergencyWithdrawal() external {
        if (msg.sender != defender) revert OnlyDefender();
        if (status != ChallengeStatus.Active) revert ChallengeNotActive();

        emergencyRequestedAt = block.timestamp;

        emit EmergencyWithdrawalRequested(address(this), defender, block.timestamp);
    }

    function executeEmergencyWithdrawal() external nonReentrant {
        if (msg.sender != defender) revert OnlyDefender();
        if (status != ChallengeStatus.Active) revert ChallengeNotActive();
        if (emergencyRequestedAt == 0) revert EmergencyNotRequested();
        if (block.timestamp < emergencyRequestedAt + EMERGENCY_TIMELOCK) revert EmergencyTimelockNotElapsed();

        uint256 amount = prizePool;
        prizePool = 0;
        status = ChallengeStatus.Expired;

        emit EmergencyWithdrawalExecuted(address(this), defender, amount);

        if (amount > 0) {
            usdc.safeTransfer(defender, amount);
        }
    }

    function cancelEmergencyWithdrawal() external {
        if (msg.sender != defender) revert OnlyDefender();

        emergencyRequestedAt = 0;

        emit EmergencyWithdrawalCancelled(address(this), defender);
    }

    function getChallengeId() public view returns (bytes32) {
        return keccak256(abi.encode(address(this)));
    }

    function _domainSeparatorV4() internal view returns (bytes32) {
        return keccak256(abi.encode(EIP712_DOMAIN_TYPEHASH, HASHED_NAME, HASHED_VERSION, block.chainid, address(this)));
    }
}
