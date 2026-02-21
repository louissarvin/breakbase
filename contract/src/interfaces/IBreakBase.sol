// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IBreakBase {

    enum PricingModel {
        Fixed,
        Escalating
    }

    enum ChallengeStatus {
        Active,
        Resolved,
        Expired,
        Cancelled
    }

    struct ChallengeConfig {
        address defender;
        address usdc;
        uint256 basePrice;
        uint256 maxFee;
        uint48 duration;
        uint16 growthRateBps;
        PricingModel pricingModel;
    }

    error ZeroAddress();
    error ZeroAmount();
    error InvalidDuration();
    error InvalidBasePrice();
    error ChallengeNotActive();
    error ChallengeNotExpired();
    error DeadlineExpired();
    error InvalidSignature();
    error InvalidOracle();
    error BasePriceTooLow();
    error DurationTooLong();
    error OnlyDefender();
    error ChallengeAlreadyExists();
    error InvalidAttemptNumber();
    error CannotCancelWithParticipants();
    error MaxFeeBelowBasePrice();
    error InvalidGrowthRate();
    error MaxFeeRequired();
    error CoinbaseVerificationRequired();
    error EASNotConfigured();
    error EmergencyNotRequested();
    error EmergencyTimelockNotElapsed();

    event ChallengeCreated(
        bytes32 indexed challengeId,
        address indexed clone,
        address indexed defender,
        uint256 basePrice,
        uint48 duration,
        PricingModel pricingModel
    );
    event MessageSent(
        address indexed challenge,
        address indexed player,
        uint256 fee,
        uint256 prizeShare,
        uint256 defenderShare,
        uint256 protocolShare,
        uint256 messageCount
    );
    event ChallengeResolved(
        address indexed challenge, address indexed winner, address recipient, uint256 prizeAmount, uint256 attemptNumber
    );
    event ChallengeExpired(address indexed challenge, address indexed defender, uint256 prizeAmount);
    event ChallengeCancelled(address indexed challenge, address indexed defender, uint256 prizeAmount);
    event PrizePoolSeeded(address indexed challenge, address indexed funder, uint256 amount);
    event ChallengeInitialized(
        address indexed challenge,
        address indexed defender,
        address oracle,
        uint256 basePrice,
        uint48 duration,
        PricingModel pricingModel
    );
    event EmergencyWithdrawalRequested(address indexed challenge, address indexed defender, uint256 requestedAt);
    event EmergencyWithdrawalExecuted(address indexed challenge, address indexed defender, uint256 amount);
    event EmergencyWithdrawalCancelled(address indexed challenge, address indexed defender);
    event ListingFeeUpdated(uint256 oldFee, uint256 newFee);
    event ListingFeeCollected(bytes32 indexed challengeId, address indexed payer, uint256 fee);
}
