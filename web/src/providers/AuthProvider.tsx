import { createContext, useCallback, useEffect, useState } from 'react'
import type { User } from '@/lib/api/hooks'
import type { AuthState } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api/client'
import { useSiweLogin } from '@/hooks/useAuth'

const TOKEN_KEY = 'bb_token'

export const AuthContext = createContext<AuthState | null>(null)

function loadStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  // Note: for production, move token to httpOnly cookie via backend
  // This is acceptable for a dApp where the JWT is low-sensitivity
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function persistToken(token: string) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
  } catch {}
}

function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {}
}

interface AuthProviderProps {
  children: React.ReactNode
}

function AuthConsumer({ children }: AuthProviderProps) {
  const [token, setToken] = useState<string | null>(loadStoredToken)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    if (token) {
      apiClient.setToken(token)
    }
  }, [token])

  const handleAuthSuccess = useCallback((newToken: string, newUser: User) => {
    setToken(newToken)
    setUser(newUser)
    persistToken(newToken)
    apiClient.setToken(newToken)
  }, [])

  const { login: siweLogin } = useSiweLogin(handleAuthSuccess)

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    clearToken()
    apiClient.clearToken()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!token,
        user,
        token,
        login: siweLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function AuthProvider({ children }: AuthProviderProps) {
  return <AuthConsumer>{children}</AuthConsumer>
}
