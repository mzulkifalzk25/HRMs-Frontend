// Public API of the authentication feature (docs/ARCHITECTURE.md §2).
export { AuthProvider } from './session/auth-provider'
export type { AuthService } from './api/auth.service'
export { useAuth, useCurrentUser, type AuthState } from './session/auth-context'
export {
  dashboardPathForRole,
  DASHBOARD_PATHS,
  postLoginPath,
  safeRedirectPath,
} from './lib/role-routes'
export { fullName, initials, ROLE_LABELS, ROLES, type Role, type User } from './types'
export { LoginPage } from './pages/login-page'
export { ForgotPasswordPage } from './pages/forgot-password-page'
export { ResetPasswordPage } from './pages/reset-password-page'
export { AcceptInvitationPage } from './pages/accept-invitation-page'
export { ProfilePage } from './pages/profile-page'
