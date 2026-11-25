// Test helpers: render with the real providers (fresh QueryClient, no retries) and a memory router.
import { QueryClient } from '@tanstack/react-query'
import { render, type RenderResult } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'
import { AppProviders } from '@/app/providers/app-providers'
import { createAppRoutes } from '@/app/router/routes'
import type { AuthService, User } from '@/features/authentication'
import type { HttpClient } from '@/services/api'
import { createMockAuthService, MOCK_PASSWORD } from '@/features/authentication/api/auth.mock'
import { AuthContext, type AuthContextValue } from '@/features/authentication/session/auth-context'

export function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
}

export function renderWithProviders(
  ui: ReactElement,
  queryClient = createTestQueryClient(),
): RenderResult & { queryClient: QueryClient } {
  const result = render(<AppProviders queryClient={queryClient}>{ui}</AppProviders>)
  return Object.assign(result, { queryClient })
}

export function renderRoutes(
  routes: RouteObject[],
  initialPath = '/',
  queryClient = createTestQueryClient(),
): RenderResult & { router: ReturnType<typeof createMemoryRouter>; queryClient: QueryClient } {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] })
  const result = render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return Object.assign(result, { router, queryClient })
}

/** Demo account emails by role (fictional, mock mode). */
export const DEMO_EMAILS = {
  hr_admin: 'hr.admin@formbaxhr.test',
  manager: 'manager@formbaxhr.test',
  senior_pm: 'senior.pm@formbaxhr.test',
  associate_pm: 'associate.pm@formbaxhr.test',
  team_lead: 'team.lead@formbaxhr.test',
  employee: 'employee@formbaxhr.test',
} as const

/**
 * Render the real app routes at `path` with a fresh mock AuthService (no state shared between
 * tests). Pass `signedInAs` to start with an active session, as after a page reload.
 */
export async function renderApp(
  path: string,
  options: {
    signedInAs?: keyof typeof DEMO_EMAILS
    authService?: AuthService
    client?: HttpClient
  } = {},
) {
  const authService = options.authService ?? createMockAuthService({ latencyMs: 0 })
  if (options.signedInAs) {
    await authService.login({ email: DEMO_EMAILS[options.signedInAs], password: MOCK_PASSWORD })
  }
  const rendered = renderRoutes(createAppRoutes({ authService, client: options.client }), path)
  return Object.assign(rendered, { authService })
}

/** Provide a fixed signed-in user to components that use useCurrentUser (unit tests). */
export function withSignedInUser(
  user: User,
  children: ReactNode,
  overrides: Partial<AuthContextValue> = {},
) {
  const value: AuthContextValue = {
    state: { status: 'authenticated', user },
    service: createMockAuthService({ latencyMs: 0 }),
    login: async () => user,
    logout: async () => {},
    retryRestore: () => {},
    ...overrides,
  }
  return <AuthContext value={value}>{children}</AuthContext>
}
