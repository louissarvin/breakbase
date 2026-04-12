import { createContext, useContext } from 'react'
import type { Context } from '@farcaster/miniapp-core'
import { useFarcaster } from '@/hooks/useFarcaster'

interface FarcasterContextValue {
  isInMiniApp: boolean
  context: Context.MiniAppContext | null
  isReady: boolean
}

const FarcasterContext = createContext<FarcasterContextValue>({
  isInMiniApp: false,
  context: null,
  isReady: false,
})

export function FarcasterProvider({ children }: { children: React.ReactNode }) {
  const farcaster = useFarcaster()
  return (
    <FarcasterContext.Provider value={farcaster}>
      {children}
    </FarcasterContext.Provider>
  )
}

export function useFarcasterContext() {
  return useContext(FarcasterContext)
}
