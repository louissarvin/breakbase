import { cookieStorage, createConfig, createStorage, http } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors'
import { farcasterFrame } from '@farcaster/miniapp-wagmi-connector'
import { env } from '@/env'

const projectId = env.VITE_WALLETCONNECT_PROJECT_ID ?? ''

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [
    coinbaseWallet({
      appName: 'BreakBase',
      preference: { options: 'smartWalletOnly' },
    }),
    injected(),
    ...(projectId ? [walletConnect({ projectId })] : []),
    farcasterFrame(),
  ],
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  transports: {
    [baseSepolia.id]: http(),
  },
})
