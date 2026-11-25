import { Search } from 'lucide-react'
import { useId } from 'react'
import { Input } from '@/components/ui/input'

/**
 * Global search placeholder (P1-T14). Disabled until there is something to search
 * (employee directory, Phase 3), and says so instead of pretending to work.
 */
export function GlobalSearch() {
  const hintId = useId()
  return (
    <div className="relative w-full max-w-sm">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        aria-label="Search"
        aria-describedby={hintId}
        placeholder="Search employees, requests…"
        disabled
        className="pl-8"
      />
      <span id={hintId} className="sr-only">
        Search becomes available with the employee directory in Phase 3.
      </span>
    </div>
  )
}
