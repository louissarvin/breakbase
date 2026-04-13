import { useContext } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import type { User } from '@/lib/api/hooks'
import { AuthContext } from '@/providers/AuthProvider'
import { apiClient } from '@/lib/api/client'

export interface AuthState {
  isAuthenticated: boolean
  user: User | null
  token: string | null
  login: () => Promise<void>
  logout: () => void
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

// Internal hook used by AuthProvider to drive the SIWE login flow
export function useSiweLogin(onSuccess: (token: string, user: User) => void) {
  const { address } = useAccount()
  const { mutateAsync: signMessage } = useSignMessage()

  const login = async () => {
    if (!address) throw new Error('No wallet connected')

    console.log('[Auth] Requesting nonce for', address)
    const nonceRes = await apiClient.post<{
      success: boolean
      data: { nonce: string; message: string }
    }>('/auth/nonce', { walletAddress: address })

    const siweMessage = nonceRes.data.message
    console.log('[Auth] Got SIWE message, requesting signature...')

    const signature = await signMessage({ message: siweMessage })
    console.log('[Auth] Signature received, verifying...')

    const verifyRes = await apiClient.post<{
      success: boolean
      data: { token: string; user: User }
    }>('/auth/verify', { message: siweMessage, signature })

    const { token, user } = verifyRes.data
    console.log('[Auth] Verified, signed in as', user.walletAddress ?? address)
    apiClient.setToken(token)
    onSuccess(token, user)
  }

  return { login, address }
}
