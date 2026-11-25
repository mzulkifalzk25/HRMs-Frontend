import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AppLayout } from '@/app/layouts/app-layout'
import { MOCK_MODE_DESCRIPTION } from '@/app/layouts/shell/mock-mode-badge'
import { routes } from '@/app/router/routes'
import { renderRoutes } from '@/test/render'

function shellRoutes(serviceMode: 'mock' | 'http') {
  return [
    {
      path: '/',
      element: <AppLayout serviceMode={serviceMode} />,
      children: [{ index: true, element: <p>Page content</p>, handle: { breadcrumb: 'Overview' } }],
    },
  ]
}

describe('routing (real route table)', () => {
  it('renders the Overview page inside the shell at /', async () => {
    renderRoutes(routes, '/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getAllByRole('navigation', { name: 'Main' }).length).toBeGreaterThan(0)
  })

  it('shows the not-found page for unknown paths, still inside the shell', async () => {
    renderRoutes(routes, '/does-not-exist')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to overview' })).toHaveAttribute('href', '/')
    expect(screen.getAllByRole('navigation', { name: 'Main' }).length).toBeGreaterThan(0)
  })

  it('runs in mock mode by default in tests and shows the badge', async () => {
    renderRoutes(routes, '/')
    expect(await screen.findByRole('button', { name: /^Mock data\./ })).toBeInTheDocument()
  })
})

describe('app shell', () => {
  it('has a skip link to the main content', () => {
    renderRoutes(shellRoutes('mock'))
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main-content',
    )
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
  })

  it('marks the current page in the sidebar and breadcrumbs', () => {
    renderRoutes(shellRoutes('mock'))
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    const breadcrumb = screen.getByRole('navigation', { name: 'breadcrumb' })
    expect(within(breadcrumb).getByText('Overview')).toHaveAttribute('aria-current', 'page')
  })

  it('lists planned modules as disabled entries, never as links', () => {
    renderRoutes(shellRoutes('mock'))
    const nav = screen.getByRole('navigation', { name: 'Main' })
    for (const label of ['Employees', 'Attendance', 'Leave', 'Approvals', 'Settings']) {
      expect(within(nav).queryByRole('link', { name: new RegExp(label) })).not.toBeInTheDocument()
      const entry = within(nav).getByText(label).closest('[aria-disabled="true"]')
      expect(entry).not.toBeNull()
    }
    expect(within(nav).getAllByRole('link')).toHaveLength(1)
  })

  it('has an honestly disabled global search', () => {
    renderRoutes(shellRoutes('mock'))
    const search = screen.getByRole('searchbox', { name: 'Search' })
    expect(search).toBeDisabled()
    expect(search).toHaveAccessibleDescription(/Phase 3/)
  })

  it('opens the notification and account placeholders', async () => {
    renderRoutes(shellRoutes('mock'))
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }))
    expect(await screen.findByText(/No notifications yet/)).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')

    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    expect(await screen.findByText('Not signed in')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('opens mobile navigation in a dialog and closes it after navigating', async () => {
    renderRoutes(shellRoutes('mock'))
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    const dialog = await screen.findByRole('dialog', { name: 'Navigation' })
    await userEvent.click(within(dialog).getByRole('link', { name: 'Overview' }))
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument()
  })
})

describe('mock-mode badge (P1-T16)', () => {
  it('is visible in mock mode with an accessible explanation', () => {
    renderRoutes(shellRoutes('mock'))
    const badge = screen.getByRole('button', { name: `Mock data. ${MOCK_MODE_DESCRIPTION}` })
    expect(badge).toHaveTextContent('Mock data')
  })

  it('shows the explanation in a tooltip on keyboard focus', async () => {
    renderRoutes(shellRoutes('mock'))
    await userEvent.tab() // skip link
    await userEvent.tab() // brand link
    await userEvent.tab() // sidebar Overview
    await userEvent.tab() // mobile menu button
    await userEvent.tab() // mock badge
    expect(screen.getByRole('button', { name: /^Mock data\./ })).toHaveFocus()
    expect(await screen.findByRole('tooltip')).toHaveTextContent(MOCK_MODE_DESCRIPTION)
  })

  it('is absent when real HTTP services are used', () => {
    renderRoutes(shellRoutes('http'))
    expect(screen.queryByRole('button', { name: /Mock data/ })).not.toBeInTheDocument()
  })
})
