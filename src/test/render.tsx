// Test helpers: render with the real providers (fresh QueryClient, no retries) and a memory router.
import { QueryClient } from '@tanstack/react-query'
import { render, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'
import { AppProviders } from '@/app/providers/app-providers'

export function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
}

export function renderWithProviders(ui: ReactElement): RenderResult {
  return render(<AppProviders queryClient={createTestQueryClient()}>{ui}</AppProviders>)
}

export function renderRoutes(
  routes: RouteObject[],
  initialPath = '/',
): RenderResult & { router: ReturnType<typeof createMemoryRouter> } {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] })
  const result = render(
    <AppProviders queryClient={createTestQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return Object.assign(result, { router })
}
