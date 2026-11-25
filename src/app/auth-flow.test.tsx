// Integration tests through the real route table (P2-T04, T07, T08, T10, T19).
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DASHBOARD_PATHS, ROLES, type Role } from '@/features/authentication'
import { MOCK_PASSWORD } from '@/features/authentication/api/auth.mock'
import { createHttpClient } from '@/services/api'
import { getAccessToken } from '@/services/auth/access-token'
import { createAuthChannel } from '@/services/auth/auth-channel'
import { DEMO_EMAILS, renderApp } from '@/test/render'

const DASHBOARD_HEADINGS: Record<Role, RegExp> = {
  hr_admin: /^Welcome back, Sana$/,
  manager: /^Welcome back, Imran$/,
  senior_pm: /^Welcome back, Farah$/,
  associate_pm: /^Welcome back, Usman$/,
  team_lead: /^Welcome back, Zainab$/,
  employee: /^Welcome back, Ali$/,
}

async function signIn(email: string, password = MOCK_PASSWORD) {
  await userEvent.type(await screen.findByLabelText('Email'), email)
  await userEvent.type(screen.getByLabelText('Password'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('guards (UX only; the backend is authoritative)', () => {
  it('sends signed-out users to login with a return path', async () => {
    const { router } = await renderApp('/profile?tab=1')
    expect(await screen.findByRole('heading', { name: 'Sign in to FormbaxHR' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(new URLSearchParams(router.state.location.search).get('redirect')).toBe('/profile?tab=1')
  })

  it('shows 403 for another role’s dashboard, keeping the URL', async () => {
    const { router } = await renderApp(DASHBOARD_PATHS.hr_admin, { signedInAs: 'employee' })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Access denied' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/dashboard/hr')
    expect(screen.getByRole('link', { name: 'Go to my dashboard' })).toHaveAttribute('href', '/')
  })

  it('lets the right role in', async () => {
    await renderApp(DASHBOARD_PATHS.hr_admin, { signedInAs: 'hr_admin' })
    expect(
      await screen.findByRole('heading', { level: 1, name: DASHBOARD_HEADINGS.hr_admin }),
    ).toBeInTheDocument()
  })

  it('redirects / to the role dashboard and keeps signed-in users away from /login', async () => {
    const { router } = await renderApp('/', { signedInAs: 'team_lead' })
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard/team-lead'))
    await act(() => router.navigate('/login'))
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard/team-lead'))
  })
})

describe('login', () => {
  it.each(ROLES)('%s lands on their own dashboard', async (role) => {
    const { router } = await renderApp('/login')
    await signIn(DEMO_EMAILS[role])
    expect(
      await screen.findByRole('heading', { level: 1, name: DASHBOARD_HEADINGS[role] }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(DASHBOARD_PATHS[role])
    expect(getAccessToken()).toMatch(/^mock-access-/)
  })

  it('returns to the requested page after login', async () => {
    const { router } = await renderApp('/profile')
    await signIn(DEMO_EMAILS.manager)
    expect(await screen.findByRole('heading', { level: 1, name: 'My profile' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/profile')
  })

  it('ignores an unsafe redirect target', async () => {
    const { router } = await renderApp('/login?redirect=https://evil.example')
    await signIn(DEMO_EMAILS.employee)
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard/employee'))
  })

  it('shows field validation without calling the server', async () => {
    await renderApp('/login')
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter your email address.')
  })

  it('shows one generic error for wrong credentials', async () => {
    await renderApp('/login')
    await signIn(DEMO_EMAILS.manager, 'wrong-password')
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.')
    expect(getAccessToken()).toBeNull()
  })

  it('shows a loading state while signing in', async () => {
    const pending = new Promise<never>(() => {})
    const authService = {
      ...(await import('@/features/authentication/api/auth.mock')).createMockAuthService({
        latencyMs: 0,
      }),
      login: () => pending,
    }
    await renderApp('/login', { authService })
    await signIn(DEMO_EMAILS.manager)
    expect(await screen.findByRole('button', { name: 'Signing in…' })).toBeDisabled()
  })

  it('has no public signup and fills demo accounts only in mock mode', async () => {
    await renderApp('/login')
    expect(await screen.findByRole('heading', { name: 'Sign in to FormbaxHR' })).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /sign up|register|create account/i }),
    ).not.toBeInTheDocument()
    const demo = screen.getByRole('complementary', { name: 'Mock mode: demo accounts' })
    await userEvent.click(within(demo).getByRole('button', { name: /Team Lead/ }))
    expect(screen.getByLabelText('Email')).toHaveValue('team.lead@formbaxhr.test')
    expect(screen.getByLabelText('Password')).toHaveValue(MOCK_PASSWORD)
  })
})

describe('logout and session end', () => {
  it('signs out from the account menu, clears the session and the query cache', async () => {
    const { router, queryClient, authService } = await renderApp('/dashboard/manager', {
      signedInAs: 'manager',
    })
    expect(await screen.findByText('Approval inbox')).toBeInTheDocument()
    expect(queryClient.getQueryCache().getAll().length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('button', { name: 'Account menu for Imran Demo' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { name: 'Sign in to FormbaxHR' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toBe('')
    expect(getAccessToken()).toBeNull()
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(await authService.restoreSession()).toBeNull() // server-side session ended (blacklist)
  })

  it('still signs out locally when the server call fails (offline)', async () => {
    const base = (await import('@/features/authentication/api/auth.mock')).createMockAuthService({
      latencyMs: 0,
    })
    const authService = { ...base, logout: () => Promise.reject(new Error('offline')) }
    await authService.login({ email: DEMO_EMAILS.employee, password: MOCK_PASSWORD })
    await renderApp('/dashboard/employee', { authService })
    await userEvent.click(await screen.findByRole('button', { name: /Account menu/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }))
    expect(await screen.findByRole('heading', { name: 'Sign in to FormbaxHR' })).toBeInTheDocument()
    expect(getAccessToken()).toBeNull()
  })

  it('sends an expired session to login with a notice and a return path (central 401 handling)', async () => {
    const fetch401 = (async () =>
      new Response(JSON.stringify({ detail: 'Token expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch
    const client = createHttpClient({ baseUrl: 'http://localhost:8000/api/v1', fetch: fetch401 })
    const { router, authService } = await renderApp('/profile', { signedInAs: 'employee', client })
    expect(await screen.findByRole('heading', { level: 1, name: 'My profile' })).toBeInTheDocument()

    await authService.logout() // server side: the refresh token is no longer valid
    await expect(client.get('employees/')).rejects.toMatchObject({ status: 401 })

    expect(
      await screen.findByText('Your session expired. Please sign in again.'),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(new URLSearchParams(router.state.location.search).get('redirect')).toBe('/profile')
    expect(getAccessToken()).toBeNull()
  })

  it('signs out this tab when another tab logs out', async () => {
    await renderApp('/profile', { signedInAs: 'hr_admin' })
    expect(await screen.findByRole('heading', { level: 1, name: 'My profile' })).toBeInTheDocument()
    const otherTab = createAuthChannel()
    otherTab.post({ type: 'logout' })
    expect(await screen.findByRole('heading', { name: 'Sign in to FormbaxHR' })).toBeInTheDocument()
    expect(getAccessToken()).toBeNull()
    otherTab.close()
  })
})
