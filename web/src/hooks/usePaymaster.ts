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

  // Detect if wallet supports batch calls (EIP-5792 wallet_sendCalls).
  // Farcaster wallet executes calls sequentially (approve settles before
  // sendMessage runs), which works for approve + transferFrom patterns.
  const supportsBatch = useMemo(() => {
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
