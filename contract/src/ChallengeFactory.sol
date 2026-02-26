// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IBreakBase} from "./interfaces/IBreakBase.sol";
import {Challenge} from "./Challenge.sol";

import {IEAS} from "@eas/IEAS.sol";
import {Attestation} from "@eas/Common.sol";

contract ChallengeFactory is IBreakBase, Ownable2Step, Multicall, Pausable {
    using SafeERC20 for IERC20;

    IEAS public immutable eas;
    address public immutable implementation;
    address public protocolWallet;
    address public oracle;
    address public immutable usdc;
    address public coinbaseAttester;
    address[] public allChallenges;
    uint256 public constant DEFAULT_MIN_BASE_PRICE = 10_000;
    uint256 public constant DEFAULT_MAX_DURATION = 30 days;
    uint256 public minBasePrice;
    uint256 public maxDuration;
    uint256 public listingFee;
    bool public requireCoinbaseVerification;
    bytes32 public verifiedAccountSchemaId;

    mapping(bytes32 => address) public challenges;

    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event ProtocolWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event MinBasePriceUpdated(uint256 oldMin, uint256 newMin);
    event MaxDurationUpdated(uint256 oldMax, uint256 newMax);
    event CoinbaseVerificationUpdated(bool required, address attester, bytes32 schemaId);

    constructor(address implementation_, address protocolWallet_, address oracle_, address usdc_, address eas_)
        Ownable(msg.sender)
    {
        if (implementation_ == address(0)) revert ZeroAddress();
        if (protocolWallet_ == address(0)) revert ZeroAddress();
        if (oracle_ == address(0)) revert ZeroAddress();
        if (usdc_ == address(0)) revert ZeroAddress();

        implementation = implementation_;
        protocolWallet = protocolWallet_;
        oracle = oracle_;
        usdc = usdc_;
        eas = IEAS(eas_);
        minBasePrice = DEFAULT_MIN_BASE_PRICE;
        maxDuration = DEFAULT_MAX_DURATION;
    }

    function createChallenge(ChallengeConfig calldata config, uint256 seedAmount)
        external
        whenNotPaused
        returns (address clone, bytes32 challengeId)
    {
        if (config.defender != msg.sender) revert OnlyDefender();
        return _createChallenge(config, seedAmount);
    }

    function createProtocolChallenge(ChallengeConfig calldata config, uint256 seedAmount)
        external
        onlyOwner
        whenNotPaused
        returns (address clone, bytes32 challengeId)
    {
        return _createChallenge(config, seedAmount);
    }

    function getChallengeCount() external view returns (uint256) {
        return allChallenges.length;
    }

    function getChallenge(bytes32 id) external view returns (address) {
        return challenges[id];
    }

    function isChallengeClone(address addr) external view returns (bool) {
        bytes32 id = keccak256(abi.encode(addr));
        return challenges[id] == addr;
    }

    function setOracle(address newOracle) external onlyOwner {
        if (newOracle == address(0)) revert ZeroAddress();
        address oldOracle = oracle;
        oracle = newOracle;
        emit OracleUpdated(oldOracle, newOracle);
    }

    function setProtocolWallet(address newWallet) external onlyOwner {
        if (newWallet == address(0)) revert ZeroAddress();
        address oldWallet = protocolWallet;
        protocolWallet = newWallet;
        emit ProtocolWalletUpdated(oldWallet, newWallet);
    }

    function setMinBasePrice(uint256 newMin) external onlyOwner {
        if (newMin == 0) revert ZeroAmount();
        uint256 oldMin = minBasePrice;
        minBasePrice = newMin;
        emit MinBasePriceUpdated(oldMin, newMin);
    }

    function setMaxDuration(uint256 newMax) external onlyOwner {
        if (newMax == 0) revert InvalidDuration();
        uint256 oldMax = maxDuration;
        maxDuration = newMax;
        emit MaxDurationUpdated(oldMax, newMax);
    }

    function setCoinbaseVerification(bool required, address attester, bytes32 schemaId) external onlyOwner {
        requireCoinbaseVerification = required;
        coinbaseAttester = attester;
        verifiedAccountSchemaId = schemaId;
        emit CoinbaseVerificationUpdated(required, attester, schemaId);
    }

    function setListingFee(uint256 fee) external onlyOwner {
        uint256 oldFee = listingFee;
        listingFee = fee;
        emit ListingFeeUpdated(oldFee, fee);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _createChallenge(ChallengeConfig calldata config, uint256 seedAmount)
        internal
        returns (address clone, bytes32 challengeId)
    {
        if (config.defender == address(0)) revert ZeroAddress();
        if (config.usdc != usdc) revert ZeroAddress();
        if (config.basePrice < minBasePrice) revert BasePriceTooLow();
        if (config.duration == 0) revert InvalidDuration();
        if (config.duration > maxDuration) revert DurationTooLong();

        if (requireCoinbaseVerification) {
            _checkCoinbaseVerification(config.defender);
        }

        if (config.pricingModel == PricingModel.Escalating) {
            if (config.growthRateBps == 0) revert InvalidGrowthRate();
            if (config.maxFee == 0) revert MaxFeeRequired();
            if (config.maxFee < config.basePrice) revert MaxFeeBelowBasePrice();
        }

        clone = Clones.clone(implementation);

        Challenge(clone).initialize(config, oracle, protocolWallet);

        challengeId = keccak256(abi.encode(clone));
        if (challenges[challengeId] != address(0)) revert ChallengeAlreadyExists();
        challenges[challengeId] = clone;
        allChallenges.push(clone);

        emit ChallengeCreated(
            challengeId, clone, config.defender, config.basePrice, config.duration, config.pricingModel
        );

        if (listingFee > 0) {
            emit ListingFeeCollected(challengeId, msg.sender, listingFee);
            IERC20(usdc).safeTransferFrom(msg.sender, protocolWallet, listingFee);
        }

        if (seedAmount > 0) {
            IERC20(usdc).safeTransferFrom(msg.sender, address(this), seedAmount);
            IERC20(usdc).forceApprove(clone, seedAmount);
            Challenge(clone).seedPrizePool(seedAmount);
        }
    }

    function _checkCoinbaseVerification(address account) internal view {
        if (address(eas) == address(0)) revert EASNotConfigured();

        bytes32 lookupUid = keccak256(abi.encodePacked(account, verifiedAccountSchemaId, coinbaseAttester));

        Attestation memory att = eas.getAttestation(lookupUid);

        bool isValid = att.uid != bytes32(0) && att.schema == verifiedAccountSchemaId
            && att.attester == coinbaseAttester && att.recipient == account && att.revocationTime == 0;

        if (!isValid) revert CoinbaseVerificationRequired();
    }
}
