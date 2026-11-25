// HTTP AuthService (proposed endpoints, docs/API_INTEGRATION.md §4). The backend does not exist yet.
// Cookies are included on login/refresh/logout so the httpOnly refresh cookie works across origins (D-079).
import { ApiError, type HttpClient } from '@/services/api'
import { withRefreshLock } from '@/services/auth/refresh-lock'
import { apiSessionSchema, apiTokenCheckSchema, apiUserSchema } from '../schemas/auth.schema'
import type { AuthSession } from '../types'
import type { AuthService } from './auth.service'

export function createHttpAuthService(client: HttpClient): AuthService {
  const toSession = (body: { access: string; user: AuthSession['user'] }): AuthSession => ({
    accessToken: body.access,
    user: body.user,
  })

  async function refresh(): Promise<AuthSession> {
    const body = await withRefreshLock(() =>
      client.post('auth/token/refresh/', undefined, {
        auth: false,
        credentials: 'include',
        schema: apiSessionSchema,
      }),
    )
    return toSession(body)
  }

  return {
    async login(credentials) {
      const body = await client.post('auth/login/', credentials, {
        auth: false,
        credentials: 'include',
        schema: apiSessionSchema,
      })
      return toSession(body)
    },

    async logout() {
      await client.post('auth/logout/', undefined, { credentials: 'include' })
    },

    async restoreSession() {
      try {
        return await refresh()
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null
        throw error
      }
    },

    refresh,

    getCurrentUser({ signal } = {}) {
      return client.get('auth/me/', { schema: apiUserSchema, signal })
    },

    async requestPasswordReset(email) {
      await client.post('auth/password-reset/', { email }, { auth: false })
    },

    checkResetToken(token) {
      return client.post(
        'auth/password-reset/validate/',
        { token },
        { auth: false, schema: apiTokenCheckSchema },
      )
    },

    async resetPassword(token, password) {
      await client.post('auth/password-reset/confirm/', { token, password }, { auth: false })
    },

    checkInvitation(token) {
      return client.post(
        'auth/invitations/validate/',
        { token },
        { auth: false, schema: apiTokenCheckSchema },
      )
    },

    async acceptInvitation(token, password) {
      await client.post('auth/invitations/accept/', { token, password }, { auth: false })
    },
  }
}
