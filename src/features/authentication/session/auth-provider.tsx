// Session handling (P2-T03, P2-T10, P2-T19; D-078/D-079).
// - Access token in memory only (services/auth/access-token).
// - On start: restore the session with one refresh (httpOnly cookie in HTTP mode).
// - Wires the API client: bearer token, refresh-on-401 (rotation, cross-tab lock), session expiry.
// - Logout: best-effort server blacklist, then ALWAYS clear token + query cache, and tell other tabs.
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { apiClient, type HttpClient } from '@/services/api'
import { clearAccessToken, getAccessToken, setAccessToken } from '@/services/auth/access-token'
import { createAuthChannel, type AuthChannel } from '@/services/auth/auth-channel'
import { services } from '@/services/registry'
import type { AuthService } from '../api/auth.service'
import { AuthContext, type AuthContextValue, type AuthState } from './auth-context'

type AuthProviderProps = {
  children: ReactNode
  /** Injected in tests. */
  authService?: AuthService
  client?: HttpClient
  channel?: AuthChannel
}

export function AuthProvider({
  children,
  authService = services.auth,
  client = apiClient,
  channel: injectedChannel,
}: AuthProviderProps) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({ status: 'restoring' })
  // Created per mount inside an effect: StrictMode's simulated unmount must not leave a closed channel.
  const channelRef = useRef<AuthChannel | null>(null)
  const restoreStarted = useRef(false)

  const endSession = useCallback(
    (reason: 'logged_out' | 'expired', broadcast: boolean) => {
      clearAccessToken()
      queryClient.clear()
      setState({ status: 'unauthenticated', reason })
      if (broadcast)
        channelRef.current?.post({ type: reason === 'expired' ? 'session-expired' : 'logout' })
    },
    [queryClient],
  )

  const restore = useCallback(async () => {
    setState({ status: 'restoring' })
    try {
      const session = await authService.restoreSession()
      if (session) {
        setAccessToken(session.accessToken)
        setState({ status: 'authenticated', user: session.user })
      } else {
        setState({ status: 'unauthenticated', reason: 'none' })
      }
    } catch (error) {
      setState({ status: 'restore_failed', error })
    }
  }, [authService])

  // Restore once (StrictMode runs effects twice in development).
  useEffect(() => {
    if (restoreStarted.current) return
    restoreStarted.current = true
    void restore()
  }, [restore])

  // API client hooks.
  useEffect(() => {
    client.setAuthHooks({
      getAccessToken,
      refreshSession: async () => {
        try {
          const session = await authService.refresh()
          setAccessToken(session.accessToken)
          setState({ status: 'authenticated', user: session.user })
          return true
        } catch {
          return false
        }
      },
      onSessionExpired: () => endSession('expired', true),
    })
    return () => client.setAuthHooks({})
  }, [authService, client, endSession])

  // Other tabs.
  useEffect(() => {
    const channel = injectedChannel ?? createAuthChannel()
    channelRef.current = channel
    const unsubscribe = channel.subscribe((message) => {
      endSession(message.type === 'session-expired' ? 'expired' : 'logged_out', false)
    })
    return () => {
      unsubscribe()
      channelRef.current = null
      if (!injectedChannel) channel.close()
    }
  }, [endSession, injectedChannel])

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      service: authService,
      async login(credentials) {
        const session = await authService.login(credentials)
        queryClient.clear()
        setAccessToken(session.accessToken)
        setState({ status: 'authenticated', user: session.user })
        return session.user
      },
      async logout() {
        try {
          await authService.logout()
        } catch {
          // Offline or already expired: still sign out locally (D-078).
        }
        endSession('logged_out', true)
      },
      retryRestore() {
        void restore()
      },
    }),
    [authService, endSession, queryClient, restore, state],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
