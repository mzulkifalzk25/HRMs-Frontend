import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from '@/app/providers/app-error-boundary'
import { RouteErrorPage } from '@/app/router/route-error-page'
import { renderRoutes } from '@/test/render'

function Boom(): never {
  throw new Error('secret internal detail: db password=hunter2')
}

describe('AppErrorBoundary', () => {
  it('replaces a crashed tree with a safe message and a reload action', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    )
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('FormbaxHR could not load this screen')
    expect(alert).not.toHaveTextContent('hunter2')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('renders children when nothing fails', () => {
    render(
      <AppErrorBoundary>
        <p>All good</p>
      </AppErrorBoundary>,
    )
    expect(screen.getByText('All good')).toBeInTheDocument()
  })
})

describe('RouteErrorPage', () => {
  it('catches a route render error without leaking internals', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderRoutes([{ path: '/', element: <Boom />, errorElement: <RouteErrorPage /> }])
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('This page could not be displayed')
    expect(alert).not.toHaveTextContent('hunter2')
    expect(screen.getByRole('link', { name: 'Go to overview' })).toHaveAttribute('href', '/')
  })
})
