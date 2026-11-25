// Accessible form field: label, control, hint and error wired together (aria-describedby,
// aria-invalid), so screen readers announce validation messages (D-072).
import { useId, type ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export type FieldControlProps = {
  id: string
  'aria-invalid': boolean
  'aria-describedby': string | undefined
}

type FormFieldProps = {
  label: string
  error?: string
  hint?: ReactNode
  /** Extra element shown at the end of the label row, e.g. a "Forgot password?" link. */
  labelAction?: ReactNode
  className?: string
  children: (control: FieldControlProps) => ReactNode
}

export function FormField({
  label,
  error,
  hint,
  labelAction,
  className,
  children,
}: FormFieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {hint ? (
        <div id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </div>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
