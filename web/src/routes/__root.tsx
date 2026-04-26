import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import HeroUIProvider from '../providers/HeroUIProvider'
import LenisSmoothScrollProvider from '../providers/LenisSmoothScrollProvider'
import WagmiProvider from '../providers/WagmiProvider'
import { AuthProvider } from '../providers/AuthProvider'
import { X402Provider } from '../providers/X402Provider'
import { ThemeProvider } from '../providers/ThemeProvider'
import {
  FarcasterProvider,
  useFarcasterContext,
} from '../providers/FarcasterProvider'
import ErrorPage from '../components/ErrorPage'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import appCss from '../styles.css?url'

import { config } from '../config'
import type { QueryClient } from '@tanstack/react-query'
import { cnm } from '@/utils/style'

interface MyRouterContext {
  queryClient: QueryClient
}

const APP_URL = 'https://breakbase.xyz'

export const Route = createRootRouteWithContext<MyRouterContext>()({
  errorComponent: ({ error, reset }) => (
    <ErrorPage error={error} reset={reset} />
  ),
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'BreakBase - AI Adversarial Testing Platform',
      },
      {
        name: 'description',
        content:
          'Break the AI. Win the prize. BreakBase is an adversarial AI testing platform built on Base L2.',
      },
      {
        property: 'og:title',
        content: 'BreakBase - AI Adversarial Testing Platform',
      },
      {
        property: 'og:description',
        content:
          'Break the AI. Win the prize. BreakBase is an adversarial AI testing platform built on Base L2.',
      },
      {
        property: 'og:image',
        content: 'https://breakbase.vercel.app/farcaster/icon-1024.png',
      },
      {
        property: 'og:url',
        content: 'https://breakbase.vercel.app',
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        name: 'base:app_id',
        content: '69edd865e6b83cf73ad1da94',
      },
      {
        name: 'fc:miniapp',
        content: JSON.stringify({
          version: '1',
          imageUrl: `${config.apiUrl}/frames/og`,
          button: {
            title: 'Break an AI',
            action: {
              type: 'launch_miniapp',
              url: APP_URL,
              name: 'BreakBase',
              splashImageUrl: `${config.apiUrl}/frames/og`,
              splashBackgroundColor: '#0A0A0B',
            },
          },
        }),
      },
      {
        name: 'fc:frame',
        content: JSON.stringify({
          version: 'next',
          imageUrl: `${config.apiUrl}/frames/og`,
          button: {
            title: 'Break an AI',
            action: {
              type: 'launch_frame',
              url: APP_URL,
              name: 'BreakBase',
              splashImageUrl: `${config.apiUrl}/frames/og`,
              splashBackgroundColor: '#0A0A0B',
            },
          },
        }),
      },
    ],
    links: [
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/assets/logo-index.svg',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
})

function AppShell({ children }: { children: React.ReactNode }) {
  const { isInMiniApp } = useFarcasterContext()

  return (
    <>
      {!isInMiniApp && <Navbar />}
      <main
        className={cnm(
          'min-h-screen bg-[#FDFDFF] dark:bg-[#0A0B0D] relative z-10 rounded-b-[2.5rem]',
          !isInMiniApp && 'pt-16',
        )}
      >
        {children}
      </main>
      {!isInMiniApp && <Footer />}
    </>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-[#FDFDFF] dark:bg-[#0A0B0D] text-[#0A0B0D] dark:text-[#E5E7EB] antialiased">
        <ThemeProvider>
          <WagmiProvider>
            <FarcasterProvider>
              <X402Provider>
                <AuthProvider>
                  <HeroUIProvider>
                    <LenisSmoothScrollProvider />
                    <AppShell>{children}</AppShell>
                    <TanStackDevtools
                      config={{
                        position: 'bottom-right',
                      }}
                      plugins={[
                        {
                          name: 'Tanstack Router',
                          render: <TanStackRouterDevtoolsPanel />,
                        },
                        TanStackQueryDevtools,
                      ]}
                    />
                  </HeroUIProvider>
                </AuthProvider>
              </X402Provider>
            </FarcasterProvider>
          </WagmiProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
