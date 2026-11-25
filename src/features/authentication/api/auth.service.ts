// AuthService contract (P2-T02). Implemented by auth.http.ts (Django, D-078/D-079) and auth.mock.ts.
import type { AuthSession, LoginCredentials, TokenCheck, User } from '../types'

export interface AuthService {
  /** Sign in. Wrong email or password → ApiError 401 with a generic message (no account enumeration). */
  login(credentials: LoginCredentials): Promise<AuthSession>
  /** Ask the backend to blacklist the refresh token (D-078). Callers clear the local session even if this fails. */
  logout(): Promise<void>
  /** After a page reload: one refresh via the httpOnly cookie. Resolves null when there is no valid session. */
  restoreSession(): Promise<AuthSession | null>
  /** New access token; the refresh token rotates (D-079). Rejects with ApiError 401 when the session ended. */
  refresh(): Promise<AuthSession>
  getCurrentUser(options?: { signal?: AbortSignal }): Promise<User>
  /** Always resolves for a well-formed email, whether or not an account exists (no enumeration). */
  requestPasswordReset(email: string): Promise<void>
  checkResetToken(token: string): Promise<TokenCheck>
  resetPassword(token: string, password: string): Promise<void>
  checkInvitation(token: string): Promise<TokenCheck>
  acceptInvitation(token: string, password: string): Promise<void>
}
