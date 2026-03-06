// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, Vm} from "forge-std/Test.sol";
import {ReputationOracle} from "../src/ReputationOracle.sol";
import {MockEAS, MockSchemaRegistry} from "./mocks/MockEAS.sol";

/// @title ReputationOracleTest
/// @notice Tests for ReputationOracle.sol covering schema registration, attestation creation,
///         authorization, and access control.
contract ReputationOracleTest is Test {
    // -------------------------------------------------------------------------
    // Accounts
    // -------------------------------------------------------------------------
    address public owner;
    address public authorizedCaller;
    address public nonOwner;
    address public attacker;
    address public defender;
    address public agent;

    // -------------------------------------------------------------------------
    // Contracts
    // -------------------------------------------------------------------------
    MockEAS public eas;
    MockSchemaRegistry public schemaRegistry;
    ReputationOracle public oracle;

    // -------------------------------------------------------------------------
    // Setup
    // -------------------------------------------------------------------------

    function setUp() public {
        owner = address(this);
        authorizedCaller = makeAddr("authorizedCaller");
        nonOwner = makeAddr("nonOwner");
        attacker = makeAddr("attacker");
        defender = makeAddr("defender");
        agent = makeAddr("agent");

        eas = new MockEAS();
        schemaRegistry = new MockSchemaRegistry();

        oracle = new ReputationOracle(address(eas));
        oracle.setAuthorizedCaller(authorizedCaller, true);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _registerSchemas() internal {
        oracle.registerSchemas(address(schemaRegistry));
    }

    // =========================================================================
    // Constructor
    // =========================================================================

    function test_constructor_setsState() public view {
        assertEq(address(oracle.eas()), address(eas));
        assertEq(oracle.owner(), owner);
    }

    function test_constructor_reverts_zeroEas() public {
        vm.expectRevert(ReputationOracle.ZeroAddress.selector);
        new ReputationOracle(address(0));
    }

    // =========================================================================
    // registerSchemas
    // =========================================================================

    function test_registerSchemas_setsIds() public {
        assertEq(oracle.attackerSchemaId(), bytes32(0));
        assertEq(oracle.defenderSchemaId(), bytes32(0));
        assertEq(oracle.auditSchemaId(), bytes32(0));

        _registerSchemas();

        assertTrue(oracle.attackerSchemaId() != bytes32(0), "attacker schema set");
        assertTrue(oracle.defenderSchemaId() != bytes32(0), "defender schema set");
        assertTrue(oracle.auditSchemaId() != bytes32(0), "audit schema set");
    }

    function test_registerSchemas_onlyOnce() public {
        _registerSchemas();

        vm.expectRevert(ReputationOracle.SchemasAlreadyRegistered.selector);
        oracle.registerSchemas(address(schemaRegistry));
    }

    function test_registerSchemas_onlyOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        oracle.registerSchemas(address(schemaRegistry));
    }

    function test_registerSchemas_reverts_zeroRegistry() public {
        vm.expectRevert(ReputationOracle.ZeroAddress.selector);
        oracle.registerSchemas(address(0));
    }

    function test_registerSchemas_emitsEvent() public {
        vm.recordLogs();
        _registerSchemas();

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 eventSig = keccak256("SchemasRegistered(bytes32,bytes32,bytes32)");
        bool found = false;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == eventSig) {
                found = true;
                break;
            }
        }
        assertTrue(found, "SchemasRegistered event emitted");
    }

    // =========================================================================
    // setSchemaIds
    // =========================================================================

    function test_setSchemaIds_manual() public {
        bytes32 a = keccak256("attacker");
        bytes32 d = keccak256("defender");
        bytes32 au = keccak256("audit");

        oracle.setSchemaIds(a, d, au);

        assertEq(oracle.attackerSchemaId(), a);
        assertEq(oracle.defenderSchemaId(), d);
        assertEq(oracle.auditSchemaId(), au);
    }

    function test_setSchemaIds_onlyOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        oracle.setSchemaIds(bytes32(uint256(1)), bytes32(uint256(2)), bytes32(uint256(3)));
    }

    function test_setSchemaIds_emitsEvent() public {
        bytes32 a = keccak256("attacker");
        bytes32 d = keccak256("defender");
        bytes32 au = keccak256("audit");

        vm.expectEmit(false, false, false, true);
        emit ReputationOracle.SchemaIdsUpdated(a, d, au);

        oracle.setSchemaIds(a, d, au);
    }

    function test_setSchemaIds_canOverwrite() public {
        _registerSchemas();

        bytes32 newA = keccak256("newAttacker");
        bytes32 newD = keccak256("newDefender");
        bytes32 newAu = keccak256("newAudit");

        oracle.setSchemaIds(newA, newD, newAu);

        assertEq(oracle.attackerSchemaId(), newA);
        assertEq(oracle.defenderSchemaId(), newD);
        assertEq(oracle.auditSchemaId(), newAu);
    }

    // =========================================================================
    // setAuthorizedCaller
    // =========================================================================

    function test_setAuthorizedCaller_onlyOwner() public {
        address newCaller = makeAddr("newCaller");

        oracle.setAuthorizedCaller(newCaller, true);
        assertTrue(oracle.authorizedCallers(newCaller));

        oracle.setAuthorizedCaller(newCaller, false);
        assertFalse(oracle.authorizedCallers(newCaller));

        vm.prank(nonOwner);
        vm.expectRevert();
        oracle.setAuthorizedCaller(newCaller, true);
    }

    function test_setAuthorizedCaller_reverts_zeroAddress() public {
        vm.expectRevert(ReputationOracle.ZeroAddress.selector);
        oracle.setAuthorizedCaller(address(0), true);
    }

    function test_setAuthorizedCaller_emitsEvent() public {
        address newCaller = makeAddr("newCaller");

        vm.expectEmit(true, false, false, true);
        emit ReputationOracle.AuthorizedCallerUpdated(newCaller, true);

        oracle.setAuthorizedCaller(newCaller, true);
    }

    // =========================================================================
    // createAttackerAttestation
    // =========================================================================

    function test_createAttackerAttestation_succeeds() public {
        _registerSchemas();

        bytes32 challengeId = keccak256("challenge1");

        vm.prank(authorizedCaller);
        bytes32 attestationId =
            oracle.createAttackerAttestation(attacker, challengeId, "prompt injection", 8, 1, 5, 1_000_000);

        assertTrue(attestationId != bytes32(0), "attestation created");
    }

    function test_createAttackerAttestation_reverts_unauthorized() public {
        _registerSchemas();

        vm.prank(nonOwner);
        vm.expectRevert(ReputationOracle.Unauthorized.selector);
        oracle.createAttackerAttestation(attacker, keccak256("challenge1"), "prompt injection", 8, 1, 5, 1_000_000);
    }

    function test_createAttackerAttestation_reverts_noSchema() public {
        // Schema not registered
        vm.prank(authorizedCaller);
        vm.expectRevert(ReputationOracle.SchemaNotRegistered.selector);
        oracle.createAttackerAttestation(attacker, keccak256("challenge1"), "prompt injection", 8, 1, 5, 1_000_000);
    }

    function test_createAttackerAttestation_emitsEvent() public {
        _registerSchemas();

        bytes32 challengeId = keccak256("challenge1");

        vm.prank(authorizedCaller);
        vm.recordLogs();
        oracle.createAttackerAttestation(attacker, challengeId, "prompt injection", 8, 1, 5, 1_000_000);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 eventSig = keccak256("AttackerAttested(bytes32,address,bytes32,uint256)");
        bool found = false;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == eventSig) {
                found = true;
                break;
            }
        }
        assertTrue(found, "AttackerAttested event emitted");
    }

    // =========================================================================
    // createDefenderAttestation
    // =========================================================================

    function test_createDefenderAttestation_succeeds() public {
        _registerSchemas();

        bytes32 challengeId = keccak256("challenge2");

        vm.prank(authorizedCaller);
        bytes32 attestationId =
            oracle.createDefenderAttestation(defender, challengeId, 100, 604800, 5_000_000, false, "gpt-4");

        assertTrue(attestationId != bytes32(0), "attestation created");
    }

    function test_createDefenderAttestation_reverts_unauthorized() public {
        _registerSchemas();

        vm.prank(nonOwner);
        vm.expectRevert(ReputationOracle.Unauthorized.selector);
        oracle.createDefenderAttestation(defender, keccak256("challenge2"), 100, 604800, 5_000_000, false, "gpt-4");
    }

    function test_createDefenderAttestation_reverts_noSchema() public {
        vm.prank(authorizedCaller);
        vm.expectRevert(ReputationOracle.SchemaNotRegistered.selector);
        oracle.createDefenderAttestation(defender, keccak256("challenge2"), 100, 604800, 5_000_000, false, "gpt-4");
    }

    function test_createDefenderAttestation_emitsEvent() public {
        _registerSchemas();

        bytes32 challengeId = keccak256("challenge2");

        vm.prank(authorizedCaller);
        vm.recordLogs();
        oracle.createDefenderAttestation(defender, challengeId, 100, 604800, 5_000_000, true, "gpt-4");

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 eventSig = keccak256("DefenderAttested(bytes32,address,bytes32,bool)");
        bool found = false;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == eventSig) {
                found = true;
                break;
            }
        }
        assertTrue(found, "DefenderAttested event emitted");
    }

    // =========================================================================
    // createAuditAttestation
    // =========================================================================

    function test_createAuditAttestation_succeeds() public {
        _registerSchemas();

        bytes32 auditId = keccak256("audit1");

        vm.prank(authorizedCaller);
        bytes32 attestationId = oracle.createAuditAttestation(agent, auditId, 50, 45, 5, "A1,A2,A3", 85);

        assertTrue(attestationId != bytes32(0), "attestation created");
    }

    function test_createAuditAttestation_reverts_unauthorized() public {
        _registerSchemas();

        vm.prank(nonOwner);
        vm.expectRevert(ReputationOracle.Unauthorized.selector);
        oracle.createAuditAttestation(agent, keccak256("audit1"), 50, 45, 5, "A1,A2", 85);
    }

    function test_createAuditAttestation_reverts_noSchema() public {
        vm.prank(authorizedCaller);
        vm.expectRevert(ReputationOracle.SchemaNotRegistered.selector);
        oracle.createAuditAttestation(agent, keccak256("audit1"), 50, 45, 5, "A1,A2", 85);
    }

    function test_createAuditAttestation_emitsEvent() public {
        _registerSchemas();

        bytes32 auditId = keccak256("audit1");

        vm.prank(authorizedCaller);
        vm.recordLogs();
        oracle.createAuditAttestation(agent, auditId, 50, 45, 5, "A1,A2,A3", 85);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 eventSig = keccak256("AuditAttested(bytes32,address,bytes32,uint8)");
        bool found = false;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == eventSig) {
                found = true;
                break;
            }
        }
        assertTrue(found, "AuditAttested event emitted");
    }

    // =========================================================================
    // Multiple authorized callers
    // =========================================================================

    function test_multipleAuthorizedCallers() public {
        _registerSchemas();

        address caller2 = makeAddr("caller2");
        oracle.setAuthorizedCaller(caller2, true);

        // Both callers can create attestations
        vm.prank(authorizedCaller);
        bytes32 id1 = oracle.createAttackerAttestation(attacker, keccak256("c1"), "xss", 5, 7, 1, 500_000);

        vm.prank(caller2);
        bytes32 id2 = oracle.createAttackerAttestation(attacker, keccak256("c2"), "sqli", 9, 1, 3, 2_000_000);

        assertTrue(id1 != id2, "different attestation IDs");
    }

    function test_revokeAuthorizedCaller() public {
        _registerSchemas();

        oracle.setAuthorizedCaller(authorizedCaller, false);

        vm.prank(authorizedCaller);
        vm.expectRevert(ReputationOracle.Unauthorized.selector);
        oracle.createAttackerAttestation(attacker, keccak256("c1"), "xss", 5, 7, 1, 500_000);
    }

    // =========================================================================
    // createChallengeAttestations
    // =========================================================================

    function _defaultAttackerParams() internal view returns (ReputationOracle.AttackerParams memory) {
        return ReputationOracle.AttackerParams({
            attacker: attacker,
            challengeId: keccak256("linked-challenge"),
            attackType: "prompt injection",
            severity: 8,
            owaspCategory: 1,
            attemptNumber: 3,
            prizeWon: 2_000_000
        });
    }

    function _defaultDefenderParams() internal view returns (ReputationOracle.DefenderParams memory) {
        return ReputationOracle.DefenderParams({
            defender: defender,
            totalAttempts: 50,
            survivalDuration: 259200,
            prizePoolSize: 10_000_000,
            wasBreached: true,
            modelUsed: "gpt-4o"
        });
    }

    function test_createChallengeAttestations_succeeds() public {
        _registerSchemas();

        ReputationOracle.AttackerParams memory ap = _defaultAttackerParams();
        ReputationOracle.DefenderParams memory dp = _defaultDefenderParams();

        vm.prank(authorizedCaller);
        (bytes32 attackerAtt, bytes32 defenderAtt) = oracle.createChallengeAttestations(ap, dp);

        // Both UIDs must be nonzero and distinct (MockEAS returns incrementing values)
        assertTrue(attackerAtt != bytes32(0), "attacker attestation created");
        assertTrue(defenderAtt != bytes32(0), "defender attestation created");
        assertTrue(attackerAtt != defenderAtt, "UIDs are distinct");
    }

    function test_createChallengeAttestations_reverts_noAttackerSchema() public {
        // No schemas registered; attackerSchemaId is bytes32(0), so the first
        // check inside createChallengeAttestations should revert.
        ReputationOracle.AttackerParams memory ap = _defaultAttackerParams();
        ReputationOracle.DefenderParams memory dp = _defaultDefenderParams();

        vm.prank(authorizedCaller);
        vm.expectRevert(ReputationOracle.SchemaNotRegistered.selector);
        oracle.createChallengeAttestations(ap, dp);
    }

    function test_createChallengeAttestations_reverts_unauthorized() public {
        _registerSchemas();

        ReputationOracle.AttackerParams memory ap = _defaultAttackerParams();
        ReputationOracle.DefenderParams memory dp = _defaultDefenderParams();

        vm.prank(nonOwner);
        vm.expectRevert(ReputationOracle.Unauthorized.selector);
        oracle.createChallengeAttestations(ap, dp);
    }

    function test_createChallengeAttestations_emitsChallengeEvent() public {
        _registerSchemas();

        ReputationOracle.AttackerParams memory ap = _defaultAttackerParams();
        ReputationOracle.DefenderParams memory dp = _defaultDefenderParams();

        vm.prank(authorizedCaller);
        vm.recordLogs();
        oracle.createChallengeAttestations(ap, dp);

        Vm.Log[] memory logs = vm.getRecordedLogs();

        // Verify ChallengeAttestationsCreated event
        bytes32 challengeEventSig = keccak256("ChallengeAttestationsCreated(bytes32,bytes32,bytes32)");
        bool foundChallenge = false;

        // Also verify AttackerAttested and DefenderAttested are emitted
        bytes32 attackerEventSig = keccak256("AttackerAttested(bytes32,address,bytes32,uint256)");
        bytes32 defenderEventSig = keccak256("DefenderAttested(bytes32,address,bytes32,bool)");
        bool foundAttacker = false;
        bool foundDefender = false;

        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == challengeEventSig) foundChallenge = true;
            if (logs[i].topics[0] == attackerEventSig) foundAttacker = true;
            if (logs[i].topics[0] == defenderEventSig) foundDefender = true;
        }

        assertTrue(foundChallenge, "ChallengeAttestationsCreated event emitted");
        assertTrue(foundAttacker, "AttackerAttested event emitted");
        assertTrue(foundDefender, "DefenderAttested event emitted");
    }

    // =========================================================================
    // setSchemaIds zero ID validation (audit fix)
    // =========================================================================

    function test_setSchemaIds_reverts_zeroId() public {
        bytes32 valid = keccak256("valid");

        // Zero attackerId
        vm.expectRevert(ReputationOracle.ZeroSchemaId.selector);
        oracle.setSchemaIds(bytes32(0), valid, valid);

        // Zero defenderId
        vm.expectRevert(ReputationOracle.ZeroSchemaId.selector);
        oracle.setSchemaIds(valid, bytes32(0), valid);

        // Zero auditId
        vm.expectRevert(ReputationOracle.ZeroSchemaId.selector);
        oracle.setSchemaIds(valid, valid, bytes32(0));

        // All zero
        vm.expectRevert(ReputationOracle.ZeroSchemaId.selector);
        oracle.setSchemaIds(bytes32(0), bytes32(0), bytes32(0));
    }
}
