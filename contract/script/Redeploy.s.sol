// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {Challenge} from "../src/Challenge.sol";
import {ChallengeFactory} from "../src/ChallengeFactory.sol";
import {FeeDistributor} from "../src/FeeDistributor.sol";

/// @notice Redeploy script that skips EAS schema registration (already done).
contract Redeploy is Script {
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant EAS = 0x4200000000000000000000000000000000000021;

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

        // 1. Deploy new Challenge implementation
        Challenge challengeImpl = new Challenge();
        console.log("Challenge implementation:", address(challengeImpl));

        // 2. Deploy new ChallengeFactory (with seedAmount support)
        ChallengeFactory factory = new ChallengeFactory(
            address(challengeImpl),
            protocolWallet,
            oracleAddress,
            USDC,
            EAS
        );
        console.log("ChallengeFactory:", address(factory));

        // 3. Deploy new FeeDistributor
        FeeDistributor feeDistributor = new FeeDistributor(USDC, agentWallet);
        console.log("FeeDistributor:", address(feeDistributor));

        // 4. Point factory protocolWallet to FeeDistributor
        factory.setProtocolWallet(address(feeDistributor));
        console.log("Factory protocolWallet updated to FeeDistributor:", address(feeDistributor));

        vm.stopBroadcast();

        console.log("");
        console.log("=== BreakBase Redeployment Complete ===");
        console.log("  Challenge impl:    ", address(challengeImpl));
        console.log("  ChallengeFactory:  ", address(factory));
        console.log("  FeeDistributor:    ", address(feeDistributor));
        console.log("  USDC:              ", USDC);
        console.log("  EAS:               ", EAS);
        console.log("");
        console.log("  NOTE: ReputationOracle NOT redeployed (schemas already registered).");
        console.log("  Update CHALLENGE_FACTORY_ADDRESS and FEE_DISTRIBUTOR_ADDRESS in backend .env and frontend config.ts");
    }
}
