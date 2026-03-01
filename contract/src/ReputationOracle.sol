// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

import {IEAS, AttestationRequest, AttestationRequestData} from "@eas/IEAS.sol";
import {ISchemaRegistry} from "@eas/ISchemaRegistry.sol";
import {ISchemaResolver} from "@eas/resolver/ISchemaResolver.sol";
import {EMPTY_UID, NO_EXPIRATION_TIME} from "@eas/Common.sol";

contract ReputationOracle is Ownable2Step {
    error ZeroAddress();
    error ZeroSchemaId();
    error Unauthorized();
    error SchemasAlreadyRegistered();
    error SchemaNotRegistered();

    struct AttackerParams {
        address attacker;
        bytes32 challengeId;
        string attackType;
        uint8 severity;
        uint8 owaspCategory;
        uint256 attemptNumber;
        uint256 prizeWon;
    }

    struct DefenderParams {
        address defender;
        uint256 totalAttempts;
        uint256 survivalDuration;
        uint256 prizePoolSize;
        bool wasBreached;
        string modelUsed;
    }

    string public constant ATTACKER_SCHEMA =
        "address attacker,bytes32 challengeId,string attackType,uint8 severity,uint8 owaspCategory,uint256 attemptNumber,uint256 prizeWon,uint256 timestamp";
    string public constant DEFENDER_SCHEMA =
        "address defender,bytes32 challengeId,uint256 totalAttempts,uint256 survivalDuration,uint256 prizePoolSize,bool wasBreached,string modelUsed,uint256 timestamp";
    string public constant AUDIT_SCHEMA =
        "address agent,bytes32 auditId,uint256 totalTests,uint256 passed,uint256 failed,string owaspCoverage,uint8 securityScore,uint256 timestamp";
    IEAS public immutable eas;

    bytes32 public attackerSchemaId;
    bytes32 public defenderSchemaId;
    bytes32 public auditSchemaId;

    mapping(address => bool) public authorizedCallers;

    event SchemasRegistered(bytes32 attackerSchemaId, bytes32 defenderSchemaId, bytes32 auditSchemaId);
    event SchemaIdsUpdated(bytes32 attackerSchemaId, bytes32 defenderSchemaId, bytes32 auditSchemaId);
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);
    event AttackerAttested(
        bytes32 indexed attestationId, address indexed attacker, bytes32 indexed challengeId, uint256 prizeWon
    );
    event DefenderAttested(
        bytes32 indexed attestationId, address indexed defender, bytes32 indexed challengeId, bool wasBreached
    );
    event AuditAttested(
        bytes32 indexed attestationId, address indexed agent, bytes32 indexed auditId, uint8 securityScore
    );
    event ChallengeAttestationsCreated(
        bytes32 indexed attackerAttestation, bytes32 indexed defenderAttestation, bytes32 indexed challengeId
    );

    modifier onlyAuthorized() {
        if (!authorizedCallers[msg.sender]) revert Unauthorized();
        _;
    }

    constructor(address eas_) Ownable(msg.sender) {
        if (eas_ == address(0)) revert ZeroAddress();
        eas = IEAS(eas_);
    }

    function registerSchemas(address schemaRegistry) external onlyOwner {
        if (attackerSchemaId != bytes32(0)) revert SchemasAlreadyRegistered();
        if (schemaRegistry == address(0)) revert ZeroAddress();

        ISchemaRegistry registry = ISchemaRegistry(schemaRegistry);
        ISchemaResolver noResolver = ISchemaResolver(address(0));

        attackerSchemaId = registry.register(ATTACKER_SCHEMA, noResolver, true);
        defenderSchemaId = registry.register(DEFENDER_SCHEMA, noResolver, true);
        auditSchemaId = registry.register(AUDIT_SCHEMA, noResolver, true);

        emit SchemasRegistered(attackerSchemaId, defenderSchemaId, auditSchemaId);
    }

    function setSchemaIds(bytes32 attackerId, bytes32 defenderId, bytes32 auditId) external onlyOwner {
        if (attackerId == bytes32(0) || defenderId == bytes32(0) || auditId == bytes32(0)) revert ZeroSchemaId();

        attackerSchemaId = attackerId;
        defenderSchemaId = defenderId;
        auditSchemaId = auditId;

        emit SchemaIdsUpdated(attackerId, defenderId, auditId);
    }

    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        if (caller == address(0)) revert ZeroAddress();
        authorizedCallers[caller] = authorized;

        emit AuthorizedCallerUpdated(caller, authorized);
    }

    function createAttackerAttestation(
        address attacker,
        bytes32 challengeId,
        string calldata attackType,
        uint8 severity,
        uint8 owaspCategory,
        uint256 attemptNumber,
        uint256 prizeWon
    ) external onlyAuthorized returns (bytes32 attestationId) {
        if (attackerSchemaId == bytes32(0)) revert SchemaNotRegistered();

        bytes memory data = abi.encode(
            attacker, challengeId, attackType, severity, owaspCategory, attemptNumber, prizeWon, block.timestamp
        );

        attestationId = eas.attest(
            AttestationRequest({
                schema: attackerSchemaId,
                data: AttestationRequestData({
                    recipient: attacker,
                    expirationTime: NO_EXPIRATION_TIME,
                    revocable: true,
                    refUID: EMPTY_UID,
                    data: data,
                    value: 0
                })
            })
        );

        emit AttackerAttested(attestationId, attacker, challengeId, prizeWon);
    }

    function createDefenderAttestation(
        address defender,
        bytes32 challengeId,
        uint256 totalAttempts,
        uint256 survivalDuration,
        uint256 prizePoolSize,
        bool wasBreached,
        string calldata modelUsed
    ) external onlyAuthorized returns (bytes32 attestationId) {
        if (defenderSchemaId == bytes32(0)) revert SchemaNotRegistered();

        bytes memory data = abi.encode(
            defender,
            challengeId,
            totalAttempts,
            survivalDuration,
            prizePoolSize,
            wasBreached,
            modelUsed,
            block.timestamp
        );

        attestationId = eas.attest(
            AttestationRequest({
                schema: defenderSchemaId,
                data: AttestationRequestData({
                    recipient: defender,
                    expirationTime: NO_EXPIRATION_TIME,
                    revocable: true,
                    refUID: EMPTY_UID,
                    data: data,
                    value: 0
                })
            })
        );

        emit DefenderAttested(attestationId, defender, challengeId, wasBreached);
    }

    function createAuditAttestation(
        address agent,
        bytes32 auditId,
        uint256 totalTests,
        uint256 passed,
        uint256 failed,
        string calldata owaspCoverage,
        uint8 securityScore
    ) external onlyAuthorized returns (bytes32 attestationId) {
        if (auditSchemaId == bytes32(0)) revert SchemaNotRegistered();

        bytes memory data =
            abi.encode(agent, auditId, totalTests, passed, failed, owaspCoverage, securityScore, block.timestamp);

        attestationId = eas.attest(
            AttestationRequest({
                schema: auditSchemaId,
                data: AttestationRequestData({
                    recipient: agent,
                    expirationTime: NO_EXPIRATION_TIME,
                    revocable: true,
                    refUID: EMPTY_UID,
                    data: data,
                    value: 0
                })
            })
        );

        emit AuditAttested(attestationId, agent, auditId, securityScore);
    }

    function createChallengeAttestations(AttackerParams calldata ap, DefenderParams calldata dp)
        external
        onlyAuthorized
        returns (bytes32 attackerAttestation, bytes32 defenderAttestation)
    {
        if (attackerSchemaId == bytes32(0)) revert SchemaNotRegistered();
        if (defenderSchemaId == bytes32(0)) revert SchemaNotRegistered();

        attackerAttestation = _attestAttacker(ap);

        defenderAttestation = _attestDefender(dp, ap.challengeId, attackerAttestation);

        emit AttackerAttested(attackerAttestation, ap.attacker, ap.challengeId, ap.prizeWon);
        emit DefenderAttested(defenderAttestation, dp.defender, ap.challengeId, dp.wasBreached);
        emit ChallengeAttestationsCreated(attackerAttestation, defenderAttestation, ap.challengeId);
    }

    function _attestAttacker(AttackerParams calldata ap) internal returns (bytes32) {
        bytes memory data = abi.encode(
            ap.attacker,
            ap.challengeId,
            ap.attackType,
            ap.severity,
            ap.owaspCategory,
            ap.attemptNumber,
            ap.prizeWon,
            block.timestamp
        );

        return eas.attest(
            AttestationRequest({
                schema: attackerSchemaId,
                data: AttestationRequestData({
                    recipient: ap.attacker,
                    expirationTime: NO_EXPIRATION_TIME,
                    revocable: true,
                    refUID: EMPTY_UID,
                    data: data,
                    value: 0
                })
            })
        );
    }

    /// @dev Create the defender attestation linked to the attacker attestation via refUID.
    function _attestDefender(DefenderParams calldata dp, bytes32 challengeId, bytes32 refUID)
        internal
        returns (bytes32)
    {
        bytes memory data = abi.encode(
            dp.defender,
            challengeId,
            dp.totalAttempts,
            dp.survivalDuration,
            dp.prizePoolSize,
            dp.wasBreached,
            dp.modelUsed,
            block.timestamp
        );

        return eas.attest(
            AttestationRequest({
                schema: defenderSchemaId,
                data: AttestationRequestData({
                    recipient: dp.defender,
                    expirationTime: NO_EXPIRATION_TIME,
                    revocable: true,
                    refUID: refUID,
                    data: data,
                    value: 0
                })
            })
        );
    }
}
