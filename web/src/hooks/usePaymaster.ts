import { useMemo } from 'react'
import { useAccount, useCapabilities } from 'wagmi'

const PAYMASTER_URL = import.meta.env.VITE_PAYMASTER_URL as string | undefined

export function usePaymaster() {
  const { address, chainId, connector } = useAccount()
  const { data: walletCapabilities } = useCapabilities({ account: address })

  const capabilities = useMemo(() => {
    if (!walletCapabilities || !chainId || !PAYMASTER_URL) return undefined
    const chainCaps = walletCapabilities[chainId]
    if (chainCaps?.paymasterService?.supported) {
      return {
        paymasterService: {
          url: PAYMASTER_URL,
        },
      }
    }
    return undefined
  }, [walletCapabilities, chainId])

  // Detect if wallet supports batch calls (EIP-5792) independently from paymaster.
  // Farcaster wallet supports wallet_sendCalls but may not advertise atomicBatch
  // in capabilities, so also check the connector id as a fallback.
  const supportsBatch = useMemo(() => {
    // Farcaster wallet supports wallet_sendCalls (EIP-5792)
    if (connector?.id === 'farcaster') return true
    if (!walletCapabilities || !chainId) return false
    const chainCaps = walletCapabilities[chainId]
    return !!(chainCaps?.atomicBatch?.supported || chainCaps?.paymasterService?.supported)
  }, [walletCapabilities, chainId, connector])

  return {
    capabilities,
    supportsBatch,
    isSponsored: !!capabilities,
  }
}
