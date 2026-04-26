import { useEffect, useRef, useState } from 'react'
import { useConnect, useAccount } from 'wagmi'
import type { Context } from '@farcaster/miniapp-core'

export function useFarcaster() {
  const [isInMiniApp, setIsInMiniApp] = useState(false)
  const [context, setContext] = useState<Context.MiniAppContext | null>(null)
  const [isReady, setIsReady] = useState(false)
  const { connect, connectors } = useConnect()
  const { isConnected } = useAccount()
  const autoConnected = useRef(false)

  useEffect(() => {
    const init = async () => {
      try {
        const { sdk } = await import('@farcaster/miniapp-sdk')

        const inMiniApp = await sdk.isInMiniApp()
        setIsInMiniApp(inMiniApp)

        if (inMiniApp) {
          const ctx = await sdk.context
          setContext(ctx)
          await sdk.actions.ready()
          setIsReady(true)
        }
      } catch {
        setIsInMiniApp(false)
      }
    }

    init()
  }, [])

  // Auto-connect with farcasterFrame connector when inside mini app
  useEffect(() => {
    if (isInMiniApp && isReady && !isConnected && !autoConnected.current) {
      autoConnected.current = true
      const farcasterConnector = connectors.find((c) => c.id === 'farcaster')
      if (farcasterConnector) {
        connect({ connector: farcasterConnector })
      }
    }
  }, [isInMiniApp, isReady, isConnected, connect, connectors])

  return { isInMiniApp, context, isReady }
}
