// App shell with a signed-in user (P1-T14, P1-T16, P2-T09, P2-T11).
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MOCK_MODE_DESCRIPTION } from '@/app/layouts/shell/mock-mode-badge'
import { createMockAuthService } from '@/features/authentication/api/auth.mock'
import { renderApp } from '@/test/render'

describe('app shell (signed in)', () => {
  it('has a skip link, a main landmark and role-aware navigation', async () => {
    await renderApp('/profile', { signedInAs: 'manager' })
    expect(await screen.findByRole('heading', { level: 1, name: 'My profile' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main-content',
    )
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
    const nav = screen.getAllByRole('navigation', { name: 'Main' })[0]
    if (!nav) throw new Error('missing main navigation')
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard/manager',
    )
    expect(within(nav).getByRole('link', { name: 'My profile' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    // Only modules that exist for the role; HR-only administration is hidden (P2-T11).
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      'Dashboard',
      'Employees',
      'My attendance',
      'Attendance records',
      'Org chart',
      'My profile',
    ])
    expect(within(nav).queryByText('Organization')).not.toBeInTheDocument()
    expect(within(nav).queryByText('Leave')).not.toBeInTheDocument()
  })

  it('global search opens the employee directory with the search term', async () => {
    const { router } = await renderApp('/profile', { signedInAs: 'manager' })
    const search = await screen.findByRole('searchbox', { name: 'Search people' })
    await userEvent.type(search, 'hina{Enter}')
    await waitFor(() => expect(router.state.location.pathname).toBe('/employees'))
    expect(router.state.location.search).toBe('?q=hina')
  })

  it('global search is disabled with an explanation for employees', async () => {
    await renderApp('/profile', { signedInAs: 'employee' })
    const search = await screen.findByRole('searchbox', { name: 'Search people' })
    expect(search).toBeDisabled()
    expect(search).toHaveAccessibleDescription('You can find your own details under My profile.')
  })

  it('shows breadcrumbs from route handles', async () => {
    await renderApp('/profile', { signedInAs: 'employee' })
    const breadcrumb = await screen.findByRole('navigation', { name: 'breadcrumb' })
    expect(within(breadcrumb).getByText('My profile')).toHaveAttribute('aria-current', 'page')
  })

  it('shows the profile of the signed-in user (read-only)', async () => {
    await renderApp('/profile', { signedInAs: 'hr_admin' })
    expect(await screen.findByText('hr.admin@formbaxhr.test')).toBeInTheDocument()
    // Role and designation are both "HR Administrator" for this account.
    expect(screen.getAllByText('HR Administrator', { selector: 'dd' })).toHaveLength(2)
    expect(screen.getByText('FBX-1001')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('shows who is signed in in the account menu', async () => {
    await renderApp('/profile', { signedInAs: 'senior_pm' })
    await userEvent.click(
      await screen.findByRole('button', { name: 'Account menu for Farah Demo' }),
    )
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByText('senior.pm@formbaxhr.test')).toBeInTheDocument()
    expect(within(menu).getByText('Senior Project Manager')).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'My profile' })).toHaveAttribute(
      'href',
      '/profile',
    )
  })

  it('opens mobile navigation in a dialog and closes it after navigating', async () => {
    const { router } = await renderApp('/profile', { signedInAs: 'employee' })
    await userEvent.click(await screen.findByRole('button', { name: 'Open navigation' }))
    const dialog = await screen.findByRole('dialog', { name: 'Navigation' })
    await userEvent.click(within(dialog).getByRole('link', { name: 'Dashboard' }))
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument()
    // The dashboard route is lazy-loaded: the URL changes once its code has loaded.
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard/employee'))
  })

  it('shows the mock-data badge with an accessible explanation', async () => {
    await renderApp('/profile', { signedInAs: 'employee' })
    expect(
      await screen.findByRole('button', { name: `Mock data. ${MOCK_MODE_DESCRIPTION}` }),
    ).toBeInTheDocument()
  })

  it('shows the not-found page for unknown paths inside the shell', async () => {
    await renderApp('/does-not-exist', { signedInAs: 'employee' })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('navigation', { name: 'Main' }).length).toBeGreaterThan(0)
  })
})

describe('session restore', () => {
  it('shows a loading state, then an error with retry when the server cannot be reached', async () => {
    const base = createMockAuthService({ latencyMs: 0 })
    let attempts = 0
    const authService = {
      ...base,
      restoreSession: async () => {
        attempts += 1
        if (attempts === 1) throw new TypeError('network down')
        return null
      },
    }
    await renderApp('/profile', { authService })
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not restore your session')
    expect(screen.getByRole('alert')).not.toHaveTextContent('network down')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Sign in to FormbaxHR' })).toBeInTheDocument()
  })
})
