import { ethers, Wallet, verifyTypedData } from 'ethers';
import type { TypedDataDomain } from 'ethers';
import { ORACLE_PRIVATE_KEY, CHAIN_ID, ORACLE_SIGNATURE_DEADLINE_SECONDS } from '../config/main-config.ts';

// EIP-712 types matching Challenge.sol CHALLENGE_RESULT_TYPEHASH
// keccak256("ChallengeResult(bytes32 challengeId,address winner,uint256 attemptNumber,uint256 deadline)")
const EIP712_TYPES = {
  ChallengeResult: [
    { name: 'challengeId', type: 'bytes32' },
    { name: 'winner', type: 'address' },
    { name: 'attemptNumber', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

// Initialize oracle wallet from private key
const oracleWallet = new Wallet(ORACLE_PRIVATE_KEY);

/**
 * Get the oracle's public address (for on-chain verification).
 */
export function getOracleAddress(): string {
  return oracleWallet.address;
}

/**
 * Compute challengeId for a clone address.
 * Mirrors Challenge.sol: keccak256(abi.encode(address(this)))
 * IMPORTANT: Uses abi.encode (pads to 32 bytes), NOT abi.encodePacked
 */
export function getChallengeId(cloneAddress: string): string {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(['address'], [cloneAddress])
  );
}

/**
 * Build the EIP-712 domain for a specific challenge clone.
 * Must match Challenge.sol _domainSeparatorV4():
 *   keccak256(abi.encode(EIP712_DOMAIN_TYPEHASH, HASHED_NAME, HASHED_VERSION, block.chainid, address(this)))
 *   where HASHED_NAME = keccak256("BreakBase"), HASHED_VERSION = keccak256("1")
 */
function getDomain(cloneAddress: string): TypedDataDomain {
  return {
    name: 'BreakBase',
    version: '1',
    chainId: CHAIN_ID,
    verifyingContract: cloneAddress,
  };
}

/**
 * Sign a ChallengeResult as the oracle.
 * Returns signature hex + deadline.
 */
export async function signChallengeResult(params: {
  cloneAddress: string;
  winner: string;
  attemptNumber: number;
}): Promise<{ signature: string; deadline: number; challengeId: string }> {
  const deadline = Math.floor(Date.now() / 1000) + ORACLE_SIGNATURE_DEADLINE_SECONDS;
  const challengeId = getChallengeId(params.cloneAddress);

  const domain = getDomain(params.cloneAddress);
  const value = {
    challengeId,
    winner: params.winner,
    attemptNumber: params.attemptNumber,
    deadline,
  };

  const signature = await oracleWallet.signTypedData(domain, EIP712_TYPES, value);

  // Verify locally before returning (defense in depth)
  const recovered = verifyTypedData(domain, EIP712_TYPES, value, signature);
  if (recovered.toLowerCase() !== oracleWallet.address.toLowerCase()) {
    throw new Error('Oracle signature local verification failed');
  }

  return { signature, deadline, challengeId };
}

/**
 * Verify a ChallengeResult signature locally.
 * Returns the recovered signer address.
 */
export function verifyChallengeResultSignature(params: {
  cloneAddress: string;
  winner: string;
  attemptNumber: number;
  deadline: number;
  signature: string;
}): string {
  const domain = getDomain(params.cloneAddress);
  const value = {
    challengeId: getChallengeId(params.cloneAddress),
    winner: params.winner,
    attemptNumber: params.attemptNumber,
    deadline: params.deadline,
  };

  return verifyTypedData(domain, EIP712_TYPES, value, params.signature);
}
