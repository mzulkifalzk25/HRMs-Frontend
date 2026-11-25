// Validate environment configuration before anything else runs (P1-T09).
import './lib/env'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import './index.css'
import { AppErrorBoundary } from './app/providers/app-error-boundary'
import { AppProviders } from './app/providers/app-providers'
import { router } from './app/router/router'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found in index.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </AppErrorBoundary>
  </StrictMode>,
)
