// Global search (P1-T14 placeholder → working in Phase 3): searches the employee directory.
// Roles without a directory (employees, D-044) see it disabled with an explanation.
import { Search } from 'lucide-react'
import { useId, useState } from 'react'
import { useNavigate } from 'react-router'
import { Input } from '@/components/ui/input'
import { useCurrentUser } from '@/features/authentication'

const DIRECTORY_ROLES = new Set(['hr_admin', 'manager', 'senior_pm', 'associate_pm', 'team_lead'])

export function GlobalSearch() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const hintId = useId()
  const [term, setTerm] = useState('')
  const enabled = DIRECTORY_ROLES.has(user.role)

  function submit(event: { preventDefault(): void }) {
    event.preventDefault()
    const value = term.trim()
    void navigate(value ? `/employees?q=${encodeURIComponent(value)}` : '/employees')
  }

  return (
    <form role="search" onSubmit={submit} className="relative w-full max-w-sm">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        aria-label="Search people"
        aria-describedby={hintId}
        placeholder={enabled ? 'Search people…' : 'Search is not available for your role'}
        disabled={!enabled}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        className="pl-8"
      />
      <span id={hintId} className="sr-only">
        {enabled
          ? 'Press Enter to search the employee directory by name, email or employee ID.'
          : 'You can find your own details under My profile.'}
      </span>
    </form>
  )
}
