// Searchable multi-choice list (managers, teams, projects, members). A <fieldset> of native
// checkboxes: keyboard and screen-reader friendly without custom ARIA.
import { useId, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type CheckboxOption = {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

type CheckboxListProps = {
  legend: string
  options: readonly CheckboxOption[]
  value: readonly string[]
  onChange: (next: string[]) => void
  error?: string
  hint?: string
  /** Show a filter box when there are more options than this. */
  searchThreshold?: number
  emptyText?: string
  className?: string
}

export function CheckboxList({
  legend,
  options,
  value,
  onChange,
  error,
  hint,
  searchThreshold = 8,
  emptyText = 'Nothing to choose from.',
  className,
}: CheckboxListProps) {
  const id = useId()
  const [filter, setFilter] = useState('')
  const term = filter.trim().toLowerCase()
  const visible = term
    ? options.filter((o) => `${o.label} ${o.description ?? ''}`.toLowerCase().includes(term))
    : options
  const selected = new Set(value)
  const describedBy =
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') ||
    undefined

  function toggle(optionValue: string, checked: boolean) {
    onChange(checked ? [...value, optionValue] : value.filter((v) => v !== optionValue))
  }

  return (
    <fieldset
      className={cn('space-y-2', className)}
      aria-describedby={describedBy}
      aria-invalid={Boolean(error)}
    >
      <legend className="text-sm font-medium">
        {legend}
        {value.length > 0 ? (
          <span className="ml-1 font-normal text-muted-foreground">({value.length} selected)</span>
        ) : null}
      </legend>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {options.length > searchThreshold ? (
        <Input
          type="search"
          aria-label={`Filter ${legend.toLowerCase()}`}
          placeholder="Type to filter…"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      ) : null}
      <div className="max-h-52 space-y-0.5 overflow-y-auto rounded-lg border border-input bg-card p-1.5">
        {visible.length === 0 ? (
          <p className="px-2 py-3 text-center text-sm text-muted-foreground">
            {term ? 'No matches.' : emptyText}
          </p>
        ) : (
          visible.map((option) => (
            <label
              key={option.value}
              className={cn(
                'flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted',
                option.disabled && 'cursor-not-allowed opacity-60 hover:bg-transparent',
              )}
            >
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-primary"
                checked={selected.has(option.value)}
                disabled={option.disabled}
                onChange={(event) => toggle(option.value, event.target.checked)}
              />
              <span className="min-w-0">
                <span className="block">{option.label}</span>
                {option.description ? (
                  <span className="block text-xs text-muted-foreground">{option.description}</span>
                ) : null}
              </span>
            </label>
          ))
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}
