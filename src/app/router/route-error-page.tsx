// Router error element: renders when a route throws while loading or rendering.
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { ErrorState } from '@/components/feedback/error-state'
import { Button } from '@/components/ui/button'
import { userMessage } from '@/services/api'

export function RouteErrorPage() {
  const error = useRouteError()
  if (import.meta.env.DEV) console.error('Route error', error)

  const message = isRouteErrorResponse(error)
    ? error.status === 404
      ? 'This page does not exist.'
      : `The page could not be loaded (status ${error.status}).`
    : userMessage(error)

  return (
    <main className="mx-auto flex min-h-svh max-w-lg items-center p-6">
      <ErrorState
        className="w-full"
        title="This page could not be displayed"
        message={message}
        onRetry={() => window.location.reload()}
      >
        <Button asChild variant="ghost">
          <Link to="/">Go to overview</Link>
        </Button>
      </ErrorState>
    </main>
  )
}
