// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {
    IEAS,
    AttestationRequest,
    DelegatedAttestationRequest,
    MultiAttestationRequest,
    MultiDelegatedAttestationRequest,
    RevocationRequest,
    DelegatedRevocationRequest,
    MultiRevocationRequest,
    MultiDelegatedRevocationRequest
} from "@eas/IEAS.sol";
import {ISchemaRegistry, SchemaRecord} from "@eas/ISchemaRegistry.sol";
import {ISchemaResolver} from "@eas/resolver/ISchemaResolver.sol";
import {Attestation} from "@eas/Common.sol";

/// @title MockEAS
/// @notice Minimal EAS mock that accepts attest() calls and returns incrementing UIDs.
contract MockEAS is IEAS {
    uint256 private _counter;

    function version() external pure returns (string memory) {
        return "1.0.0-mock";
    }

    function getSchemaRegistry() external pure returns (ISchemaRegistry) {
        return ISchemaRegistry(address(0));
    }

    function attest(AttestationRequest calldata) external payable returns (bytes32) {
        _counter++;
        return bytes32(_counter);
    }

    function attestByDelegation(DelegatedAttestationRequest calldata) external payable returns (bytes32) {
        _counter++;
        return bytes32(_counter);
    }

    function multiAttest(MultiAttestationRequest[] calldata) external payable returns (bytes32[] memory) {
        bytes32[] memory uids = new bytes32[](1);
        _counter++;
        uids[0] = bytes32(_counter);
        return uids;
    }

    function multiAttestByDelegation(MultiDelegatedAttestationRequest[] calldata)
        external
        payable
        returns (bytes32[] memory)
    {
        bytes32[] memory uids = new bytes32[](1);
        _counter++;
        uids[0] = bytes32(_counter);
        return uids;
    }

    function revoke(RevocationRequest calldata) external payable {}

    function revokeByDelegation(DelegatedRevocationRequest calldata) external payable {}

    function multiRevoke(MultiRevocationRequest[] calldata) external payable {}

    function multiRevokeByDelegation(MultiDelegatedRevocationRequest[] calldata) external payable {}

    function timestamp(bytes32) external pure returns (uint64) {
        return 0;
    }

    function multiTimestamp(bytes32[] calldata) external pure returns (uint64) {
        return 0;
    }

    function revokeOffchain(bytes32) external pure returns (uint64) {
        return 0;
    }

    function multiRevokeOffchain(bytes32[] calldata) external pure returns (uint64) {
        return 0;
    }

    function getAttestation(bytes32) external pure returns (Attestation memory) {
        Attestation memory a;
        return a;
    }

    function isAttestationValid(bytes32) external pure returns (bool) {
        return true;
    }

    function getTimestamp(bytes32) external pure returns (uint64) {
        return 0;
    }

    function getRevokeOffchain(address, bytes32) external pure returns (uint64) {
        return 0;
    }
}

/// @title MockSchemaRegistry
/// @notice Minimal SchemaRegistry mock that returns deterministic schema UIDs.
contract MockSchemaRegistry is ISchemaRegistry {
    uint256 private _counter;

    function version() external pure returns (string memory) {
        return "1.0.0-mock";
    }

    function register(string calldata schema, ISchemaResolver, bool) external returns (bytes32) {
        _counter++;
        return keccak256(abi.encode(schema, _counter));
    }

    function getSchema(bytes32) external pure returns (SchemaRecord memory) {
        SchemaRecord memory r;
        return r;
    }
}
