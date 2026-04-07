/**
 * Builder Code (ERC-8021) utility
 *
 * Appends a data suffix to transaction calldata so Base attributes
 * on-chain activity to the BreakBase application.
 *
 * Format: [ASCII hex of code] + [1-byte length] + [Schema ID: 00] + [Marker: 80218021802180218021802180218021]
 *
 * Uses the `ox` library (transitive dependency of viem, already installed).
 */
import { Attribution } from 'ox/erc8021';
import { BUILDER_CODE } from '../config/main-config.ts';

let cachedSuffix: string | null = null;

/**
 * Get the ERC-8021 data suffix to append to transaction calldata.
 * Returns the hex string WITHOUT the 0x prefix (ready to concatenate).
 * Returns empty string if builder code is not configured.
 */
export function getBuilderCodeSuffix(): string {
  if (!BUILDER_CODE) return '';
  if (cachedSuffix !== null) return cachedSuffix;

  try {
    const fullHex = Attribution.toDataSuffix({ codes: [BUILDER_CODE] });
    // Strip '0x' prefix for concatenation
    cachedSuffix = fullHex.startsWith('0x') ? fullHex.slice(2) : fullHex;
    return cachedSuffix;
  } catch (err) {
    console.error('[BuilderCode] Failed to generate suffix:', err);
    cachedSuffix = '';
    return '';
  }
}

/**
 * Append the builder code suffix to a hex-encoded calldata string.
 * If the input doesn't start with 0x, it's returned as-is.
 */
export function appendBuilderCode(calldata: string): string {
  const suffix = getBuilderCodeSuffix();
  if (!suffix) return calldata;

  if (calldata.startsWith('0x')) {
    return calldata + suffix;
  }
  return calldata;
}
