// Auth context and hooks (P2-T03). Kept separate from the provider component for fast refresh.
import { createContext, useContext } from 'react'
import type { AuthService } from '../api/auth.service'
import type { LoginCredentials, User } from '../types'

export type AuthState =
  | { status: 'restoring' }
  | { status: 'restore_failed'; error: unknown }
  | { status: 'unauthenticated'; reason: 'none' | 'logged_out' | 'expired' }
  | { status: 'authenticated'; user: User }

export type AuthContextValue = {
  state: AuthState
  /** The AuthService this session uses; password/invitation screens use the same instance. */
  service: AuthService
  login(credentials: LoginCredentials): Promise<User>
  /** Blacklists the session on the server (best effort) and always clears it locally. */
  logout(): Promise<void>
  retryRestore(): void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}

/** The signed-in user. Only use below a RequireAuth guard. */
export function useCurrentUser(): User {
  const { state } = useAuth()
  if (state.status !== 'authenticated') {
    throw new Error('useCurrentUser used without an authenticated session (missing RequireAuth?)')
  }
  return state.user
}
