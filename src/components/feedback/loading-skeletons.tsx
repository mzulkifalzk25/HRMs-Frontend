import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** Placeholder for a card while its data loads. Hidden from screen readers; pair with an aria-busy region. */
export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('space-y-3 rounded-lg border bg-card p-5 shadow-xs', className)}
    >
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cn('h-3', index === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}

/** Placeholder rows for a table or list. */
export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn('divide-y rounded-lg border bg-card', className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}
