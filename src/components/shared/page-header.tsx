import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PageHeaderProps = {
  title: string
  description?: ReactNode
  /** Page-level actions, e.g. "Add employee". */
  actions?: ReactNode
  className?: string
}

/** Title block at the top of every page. Renders the page's single <h1>. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}
