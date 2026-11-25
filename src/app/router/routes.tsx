// Route table (P1-T13). Kept separate from the browser router so tests can use a memory router.
import type { RouteObject } from 'react-router'
import { AppLayout } from '@/app/layouts/app-layout'
import { OverviewPage } from '@/features/dashboard'
import { NotFoundPage } from './not-found-page'
import type { RouteHandle } from './route-handle'
import { RouteErrorPage } from './route-error-page'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        errorElement: <RouteErrorPage />,
        children: [
          {
            index: true,
            element: <OverviewPage />,
            handle: { breadcrumb: 'Overview' } satisfies RouteHandle,
          },
          {
            path: '*',
            element: <NotFoundPage />,
            handle: { breadcrumb: 'Not found' } satisfies RouteHandle,
          },
        ],
      },
    ],
  },
]
