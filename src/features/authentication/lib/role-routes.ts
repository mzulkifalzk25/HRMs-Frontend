// Role → dashboard mapping and safe post-login redirects (P2-T08).
import type { Role } from '../types'

export const DASHBOARD_PATHS: Record<Role, string> = {
  hr_admin: '/dashboard/hr',
  manager: '/dashboard/manager',
  senior_pm: '/dashboard/senior-pm',
  associate_pm: '/dashboard/associate-pm',
  team_lead: '/dashboard/team-lead',
  employee: '/dashboard/employee',
}

export function dashboardPathForRole(role: Role): string {
  return DASHBOARD_PATHS[role]
}

const AUTH_ONLY_PATHS = ['/login', '/forgot-password', '/reset-password', '/invite']

/**
 * Validate a `redirect` query value so login can only send users to a page inside this app.
 * Rejects absolute URLs, protocol-relative URLs (`//evil.example`), backslash tricks and the
 * auth pages themselves. Returns null when the value is not safe.
 */
export function safeRedirectPath(value: string | null | undefined): string | null {
  if (!value) return null
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  if ([...value].some((char) => char.charCodeAt(0) < 0x20)) return null // control characters
  let url: URL
  try {
    url = new URL(value, 'http://formbaxhr.invalid')
  } catch {
    return null
  }
  if (url.origin !== 'http://formbaxhr.invalid') return null
  if (AUTH_ONLY_PATHS.includes(url.pathname)) return null
  return `${url.pathname}${url.search}${url.hash}`
}

/**
 * Where to go after login: the requested page if it is safe, otherwise the role's dashboard.
 * Role permission for the requested page is checked again by the route guard (UX only;
 * the backend is authoritative, D-027).
 */
export function postLoginPath(role: Role, requested: string | null | undefined): string {
  return safeRedirectPath(requested) ?? dashboardPathForRole(role)
}
