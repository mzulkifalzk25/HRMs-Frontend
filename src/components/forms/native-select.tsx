// Styled native <select>: fully accessible, native on mobile, works with React Hook Form register().
import { ChevronDown } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export type SelectOption = { value: string; label: string; disabled?: boolean }

type NativeSelectProps = ComponentProps<'select'> & {
  options: readonly SelectOption[]
  /** First, empty option, e.g. "All departments" or "Choose a department". */
  placeholder?: string
}

export function NativeSelect({ options, placeholder, className, ...props }: NativeSelectProps) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(
          'h-8 w-full appearance-none rounded-lg border border-input bg-card py-1 pr-8 pl-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
          className,
        )}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
}
