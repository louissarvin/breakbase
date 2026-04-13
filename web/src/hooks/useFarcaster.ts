import { useEffect, useState } from 'react'
import type { Context } from '@farcaster/miniapp-core'

export function useFarcaster() {
  const [isInMiniApp, setIsInMiniApp] = useState(false)
  const [context, setContext] = useState<Context.MiniAppContext | null>(null)
  const [isReady, setIsReady] = useState(false)

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

  return { isInMiniApp, context, isReady }
}
