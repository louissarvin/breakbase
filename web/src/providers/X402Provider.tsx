import { useEffect } from 'react'
import { useX402Fetch } from '@/hooks/useX402Fetch'
import { apiClient } from '@/lib/api/client'

interface X402ProviderProps {
  children: React.ReactNode
}

/**
 * Wires an x402-aware fetch into the apiClient whenever a wallet is connected.
 * Reverts to native fetch on disconnect.
 *
 * Must be rendered inside WagmiProvider.
 */
function X402Sync() {
  const x402Fetch = useX402Fetch()

  useEffect(() => {
    apiClient.setFetch(x402Fetch)
    return () => {
      apiClient.setFetch(null)
    }
  }, [x402Fetch])

  return null
}

export function X402Provider({ children }: X402ProviderProps) {
  return (
    <>
      <X402Sync />
      {children}
    </>
  )
}
