import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type SectionCardProps = {
  title: string
  description?: ReactNode
  /** Header actions, e.g. a "View all" link. */
  actions?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}

/** Titled panel on dashboards and detail pages; a labelled region for assistive technology. */
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: SectionCardProps) {
  const headingId = useId()
  return (
    <section
      aria-labelledby={headingId}
      className={cn('flex flex-col rounded-lg border bg-card shadow-xs', className)}
    >
      <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0 space-y-0.5">
          <h2 id={headingId} className="text-sm font-semibold">
            {title}
          </h2>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
      <div className={cn('flex-1 p-5', contentClassName)}>{children}</div>
    </section>
  )
}
