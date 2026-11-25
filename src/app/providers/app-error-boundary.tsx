// Last-resort error boundary around the whole app (P1-T13). Route-level errors are handled
// by the router's error element; this catches failures outside it (providers, the shell).
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from '@/components/feedback/error-state'
import { GENERIC_ERROR_MESSAGE } from '@/services/api'

type Props = { children: ReactNode }
type State = { hasError: boolean }

export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    // Development aid only. No error reporting service is configured (D-022).
    if (import.meta.env.DEV) console.error('Unhandled UI error', error, info.componentStack)
  }

  override render() {
    if (!this.state.hasError) return this.props.children
    return (
      <main className="mx-auto flex min-h-svh max-w-lg items-center p-6">
        <ErrorState
          className="w-full"
          title="FormbaxHR could not load this screen"
          message={GENERIC_ERROR_MESSAGE}
          onRetry={() => window.location.reload()}
        />
      </main>
    )
  }
}
