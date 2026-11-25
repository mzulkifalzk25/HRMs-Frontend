import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type StatCardProps = {
  label: string
  value: number | string
  icon?: LucideIcon
  /** Short context under the value, e.g. "of 48 employees". */
  hint?: ReactNode
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  className?: string
}

const ICON_TONE: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'bg-accent text-accent-foreground',
  success: 'bg-success-subtle text-success-subtle-foreground',
  warning: 'bg-warning-subtle text-warning-subtle-foreground',
  danger: 'bg-destructive-subtle text-destructive-subtle-foreground',
  info: 'bg-info-subtle text-info-subtle-foreground',
}

/** KPI tile. The label/value pair is a description list for screen readers. */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = 'default',
  className,
}: StatCardProps) {
  return (
    <div className={cn('rounded-lg border bg-card p-4 shadow-xs', className)}>
      <dl className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
          {hint ? <dd className="text-xs text-muted-foreground">{hint}</dd> : null}
        </div>
        {Icon ? (
          <span
            aria-hidden="true"
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-md',
              ICON_TONE[tone],
            )}
          >
            <Icon className="size-4.5" />
          </span>
        ) : null}
      </dl>
    </div>
  )
}
