// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {Challenge} from "../src/Challenge.sol";
import {ChallengeFactory} from "../src/ChallengeFactory.sol";
import {FeeDistributor} from "../src/FeeDistributor.sol";
import {ReputationOracle} from "../src/ReputationOracle.sol";

contract Deploy is Script {
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    address constant EAS = 0x4200000000000000000000000000000000000021;

    address constant SCHEMA_REGISTRY = 0x4200000000000000000000000000000000000020;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address protocolWallet = vm.envAddress("PROTOCOL_WALLET");
        address oracleAddress = vm.envAddress("ORACLE_ADDRESS");
        address agentWallet = vm.envAddress("AGENT_WALLET");

        console.log("Deployer:", vm.addr(deployerKey));
        console.log("Protocol Wallet:", protocolWallet);
        console.log("Oracle Address:", oracleAddress);
        console.log("Agent Wallet:", agentWallet);

        vm.startBroadcast(deployerKey);

        Challenge challengeImpl = new Challenge();
        console.log("Challenge implementation:", address(challengeImpl));

        ChallengeFactory factory = new ChallengeFactory(
            address(challengeImpl),
            protocolWallet,
            oracleAddress,
            USDC,
            EAS
        );
        console.log("ChallengeFactory:", address(factory));

        FeeDistributor feeDistributor = new FeeDistributor(USDC, agentWallet);
        console.log("FeeDistributor:", address(feeDistributor));


        ReputationOracle oracle = new ReputationOracle(EAS);
        console.log("ReputationOracle:", address(oracle));

        oracle.registerSchemas(SCHEMA_REGISTRY);
        console.log("Schemas registered.");
        console.log("  Attacker Schema UID:", vm.toString(oracle.attackerSchemaId()));
        console.log("  Defender Schema UID:", vm.toString(oracle.defenderSchemaId()));
        console.log("  Audit Schema UID:", vm.toString(oracle.auditSchemaId()));

        oracle.setAuthorizedCaller(oracleAddress, true);
        console.log("Authorized caller set:", oracleAddress);

        factory.setProtocolWallet(address(feeDistributor));
        console.log("Factory protocolWallet updated to FeeDistributor:", address(feeDistributor));

        vm.stopBroadcast();

        console.log("");
        console.log("=== BreakBase Deployment Complete ===");
        console.log("  Challenge impl:    ", address(challengeImpl));
        console.log("  ChallengeFactory:  ", address(factory));
        console.log("  FeeDistributor:    ", address(feeDistributor));
        console.log("  ReputationOracle:  ", address(oracle));
        console.log("  USDC:              ", USDC);
        console.log("  EAS:               ", EAS);
        console.log("  Schema Registry:   ", SCHEMA_REGISTRY);
    }
}
