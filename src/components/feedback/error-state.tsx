import { CircleAlert, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ErrorStateProps = {
  title?: string
  /** User-safe message. Use `userMessage(error)` from '@/services/api' to build it. */
  message: string
  /** Shows a "Try again" button when provided. */
  onRetry?: () => void
  isRetrying?: boolean
  /** Extra actions, e.g. a link back to the dashboard. */
  children?: ReactNode
  className?: string
}

/** Shown when loading data failed. Announced to screen readers via role="alert". */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  isRetrying = false,
  children,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive-subtle px-6 py-10 text-center',
        className,
      )}
    >
      <CircleAlert aria-hidden="true" className="size-6 text-destructive-subtle-foreground" />
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-destructive-subtle-foreground">{title}</h3>
        <p className="max-w-md text-sm text-foreground">{message}</p>
      </div>
      {onRetry || children ? (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {onRetry ? (
            <Button variant="outline" onClick={onRetry} disabled={isRetrying}>
              <RefreshCw aria-hidden="true" className={cn(isRetrying && 'animate-spin')} />
              {isRetrying ? 'Retrying…' : 'Try again'}
            </Button>
          ) : null}
          {children}
        </div>
      ) : null}
    </div>
  )
}
