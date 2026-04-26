import { useMemo } from 'react'
import { useAccount, useCapabilities } from 'wagmi'

const PAYMASTER_URL = import.meta.env.VITE_PAYMASTER_URL as string | undefined

export function usePaymaster() {
  const { address, chainId } = useAccount()
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

  // Detect if wallet supports batch calls (EIP-5792) independently from paymaster
  const supportsBatch = useMemo(() => {
    if (!walletCapabilities || !chainId) return false
    const chainCaps = walletCapabilities[chainId]
    // atomicBatch is the EIP-5792 capability for batched calls
    return !!(chainCaps?.atomicBatch?.supported || chainCaps?.paymasterService?.supported)
  }, [walletCapabilities, chainId])

  return {
    capabilities,
    supportsBatch,
    isSponsored: !!capabilities,
  }
}
