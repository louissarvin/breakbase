import { useMemo } from 'react'
import { usePublicClient, useWalletClient } from 'wagmi'
import { wrapFetchWithPayment, x402Client } from '@x402/fetch'
import { ExactEvmScheme } from '@x402/evm'
import type { ClientEvmSigner } from '@x402/evm'

// Base Sepolia network identifier for x402
const NETWORK = 'eip155:84532' as const

/**
 * Returns an x402-aware fetch function that automatically handles 402 responses
 * by signing USDC payment authorizations and retrying the request.
 *
 * Returns null when no wallet is connected.
 */
export function useX402Fetch(): typeof globalThis.fetch | null {
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  return useMemo(() => {
    if (!walletClient) return null

    // Adapt wagmi WalletClient to the ClientEvmSigner interface.
    // wagmi's signTypedData takes { domain, types, primaryType, message } as a
    // flat object whereas ClientEvmSigner wraps them in a `message` key.
    const signer: ClientEvmSigner = {
      address: walletClient.account.address,
      signTypedData: ({ domain, types, primaryType, message }) =>
        walletClient.signTypedData({
          domain,
          types: types as Parameters<
            typeof walletClient.signTypedData
          >[0]['types'],
          primaryType,
          message: message,
        }),
      readContract: publicClient
        ? (args) =>
            publicClient.readContract(
              args as Parameters<typeof publicClient.readContract>[0],
            )
        : undefined,
    }

    const client = new x402Client().register(
      NETWORK,
      new ExactEvmScheme(signer),
    )
    return wrapFetchWithPayment(globalThis.fetch, client)
  }, [walletClient, publicClient])
}
