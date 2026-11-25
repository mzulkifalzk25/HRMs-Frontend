import type { ReactNode } from 'react'

/** Card used by every page in the auth layout. Renders the page's single <h1>. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="w-full rounded-xl border bg-card p-6 shadow-md sm:p-8">
      <div className="mb-6 space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
      {footer ? (
        <div className="mt-6 border-t pt-4 text-sm text-muted-foreground">{footer}</div>
      ) : null}
    </div>
  )
}
