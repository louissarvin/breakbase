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

  // Detect if wallet supports atomic batch calls (EIP-5792).
  // Farcaster wallet supports wallet_sendCalls but executes sequentially (not
  // atomically), which can cause the second call to revert if the first hasn't
  // settled. Use the two-step fallback with waitForTransactionReceipt instead.
  const supportsBatch = useMemo(() => {
    if (connector?.id === 'farcaster') return false
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
