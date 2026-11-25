// Route guards (P2-T07, P2-T19). UX ONLY: they decide what to render, not what a user may access.
// The backend enforces authentication and authorization on every request (D-027).
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router'
import { ErrorState } from '@/components/feedback/error-state'
import { dashboardPathForRole, postLoginPath, useAuth, type Role } from '@/features/authentication'
import { userMessage } from '@/services/api'
import { ForbiddenPage } from '@/app/router/forbidden-page'
import { FullPageStatus } from './full-page-status'

function RestoreFailed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-lg items-center p-6">
      <ErrorState
        className="w-full"
        title="Could not restore your session"
        message={userMessage(error)}
        onRetry={onRetry}
      />
    </main>
  )
}

/** Signed-in users only. Others go to /login with a safe return path. */
export function RequireAuth() {
  const { state, retryRestore } = useAuth()
  const location = useLocation()

  if (state.status === 'restoring') return <FullPageStatus label="Restoring your session…" />
  if (state.status === 'restore_failed')
    return <RestoreFailed error={state.error} onRetry={retryRestore} />
  if (state.status === 'unauthenticated') {
    const params = new URLSearchParams()
    if (state.reason !== 'logged_out')
      params.set('redirect', `${location.pathname}${location.search}`)
    if (state.reason === 'expired') params.set('reason', 'expired')
    const query = params.toString()
    return <Navigate to={query ? `/login?${query}` : '/login'} replace />
  }
  return <Outlet />
}

/** Only the given roles; others see a 403 page in place (the URL is kept). */
export function RequireRole({ allow }: { allow: readonly Role[] }) {
  const { state } = useAuth()
  if (state.status !== 'authenticated') return null
  return allow.includes(state.user.role) ? <Outlet /> : <ForbiddenPage />
}

/**
 * Login and password pages: signed-in users are sent on. Uses the same rule as the login page
 * (`postLoginPath`: a safe `?redirect=` target, else the role dashboard), so the two never race
 * to different destinations right after sign-in.
 */
export function GuestOnly() {
  const { state, retryRestore } = useAuth()
  const [params] = useSearchParams()
  if (state.status === 'restoring') return <FullPageStatus label="Loading…" />
  if (state.status === 'restore_failed')
    return <RestoreFailed error={state.error} onRetry={retryRestore} />
  if (state.status === 'authenticated')
    return <Navigate to={postLoginPath(state.user.role, params.get('redirect'))} replace />
  return <Outlet />
}

/** `/` → the signed-in user's role dashboard (P2-T08). */
export function RoleHomeRedirect() {
  const { state } = useAuth()
  if (state.status !== 'authenticated') return null
  return <Navigate to={dashboardPathForRole(state.user.role)} replace />
}
