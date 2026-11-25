// Organizational chart (P3-T13). Tree view with keyboard navigation; a grouped list view for
// small screens (default below 768 px). Supports several managers and people without a manager.
import { List, Network } from 'lucide-react'
import { useId, useState } from 'react'
import { EmptyState } from '@/components/feedback/empty-state'
import { ErrorState } from '@/components/feedback/error-state'
import { ListSkeleton } from '@/components/feedback/loading-skeletons'
import { PageHeader } from '@/components/shared/page-header'
import { SectionCard } from '@/components/shared/section-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCurrentUser } from '@/features/authentication'
import { useMediaQuery } from '@/hooks/use-media-query'
import { userMessage } from '@/services/api'
import { useReportingLines } from '../api/use-organization'
import { OrgChartTree } from '../components/org-chart-tree'
import { buildReportingTree } from '../lib/hierarchy'
import type { ReportingLine } from '../schemas/organization.schema'

const byName = (a: ReportingLine, b: ReportingLine) => a.name.localeCompare(b.name)

export function OrgChartPage() {
  const user = useCurrentUser()
  const lines = useReportingLines()
  const wide = useMediaQuery('(min-width: 768px)')
  const [view, setView] = useState<'tree' | 'list' | null>(null)
  const activeView = view ?? (wide ? 'tree' : 'list')
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const searchId = useId()
  const inactiveId = useId()

  const people = (lines.data ?? []).filter((p) => showInactive || p.status !== 'inactive')
  const term = search.trim().toLowerCase()
  const matches = term
    ? people.filter((p) =>
        `${p.name} ${p.designation ?? ''} ${p.departmentName ?? ''}`.toLowerCase().includes(term),
      )
    : people
  // When searching, keep matches plus their managers chain so the tree still makes sense.
  const keep = new Set(matches.map((p) => p.id))
  if (term) {
    const byId = new Map(people.map((p) => [p.id, p]))
    const queue = [...keep]
    while (queue.length > 0) {
      const person = byId.get(queue.shift() ?? '')
      for (const managerId of person?.managerIds ?? []) {
        if (!keep.has(managerId) && byId.has(managerId)) {
          keep.add(managerId)
          queue.push(managerId)
        }
      }
    }
  }
  const shown = people.filter((p) => keep.has(p.id))
  const tree = buildReportingTree(shown, byName)
  const nameOf = (id: string) =>
    (lines.data ?? []).find((p) => p.id === id)?.name ?? 'someone outside your view'
  const canOpenProfiles = user.role !== 'employee'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Org chart"
        description="Who reports to whom. People can report to several managers, or to nobody."
      />
      <SectionCard
        title="Reporting hierarchy"
        description={lines.data ? `${shown.length} people` : undefined}
        actions={
          <div role="group" aria-label="View" className="flex gap-1">
            <Button
              size="sm"
              variant={activeView === 'tree' ? 'secondary' : 'ghost'}
              aria-pressed={activeView === 'tree'}
              onClick={() => setView('tree')}
            >
              <Network aria-hidden="true" />
              Tree
            </Button>
            <Button
              size="sm"
              variant={activeView === 'list' ? 'secondary' : 'ghost'}
              aria-pressed={activeView === 'list'}
              onClick={() => setView('list')}
            >
              <List aria-hidden="true" />
              List
            </Button>
          </div>
        }
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor={searchId}>Find a person</Label>
            <Input
              id={searchId}
              type="search"
              placeholder="Name, designation or department"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label htmlFor={inactiveId} className="flex items-center gap-2 text-sm">
            <input
              id={inactiveId}
              type="checkbox"
              className="size-4 accent-primary"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Show inactive people
          </label>
        </div>

        {lines.isPending ? (
          <div aria-busy="true">
            <span className="sr-only">Loading org chart…</span>
            <ListSkeleton rows={5} />
          </div>
        ) : lines.isError ? (
          <ErrorState
            title="Could not load the org chart"
            message={userMessage(lines.error)}
            onRetry={() => void lines.refetch()}
          />
        ) : shown.length === 0 ? (
          <EmptyState
            title={term ? 'Nobody matches that search' : 'No people yet'}
            className="py-8"
          />
        ) : activeView === 'tree' ? (
          <OrgChartTree
            key={`${term}|${showInactive}`}
            tree={tree}
            nameOf={nameOf}
            canOpenProfiles={canOpenProfiles}
            forceExpanded={Boolean(term)}
          />
        ) : (
          <OrgChartList people={shown} nameOf={nameOf} />
        )}
      </SectionCard>
    </div>
  )
}

/** Mobile-friendly fallback: one group per manager, plus a group for people with no manager. */
function OrgChartList({
  people,
  nameOf,
}: {
  people: ReportingLine[]
  nameOf: (id: string) => string
}) {
  const groups = new Map<string, ReportingLine[]>()
  const ids = new Set(people.map((p) => p.id))
  for (const person of people) {
    const managers = person.managerIds.filter((id) => ids.has(id))
    for (const key of managers.length > 0 ? managers : ['']) {
      groups.set(key, [...(groups.get(key) ?? []), person])
    }
  }
  const ordered = [...groups.entries()].sort(([a], [b]) =>
    a === '' ? -1 : b === '' ? 1 : nameOf(a).localeCompare(nameOf(b)),
  )
  return (
    <div className="space-y-5">
      {ordered.map(([managerId, reports]) => (
        <section
          key={managerId || 'none'}
          aria-label={managerId ? `Reports to ${nameOf(managerId)}` : 'No manager'}
        >
          <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {managerId ? `Reports to ${nameOf(managerId)}` : 'No manager'}
          </h3>
          <ul className="divide-y rounded-md border">
            {reports.sort(byName).map((p) => (
              <li key={p.id} className="px-3 py-2">
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[p.designation, p.departmentName].filter(Boolean).join(' · ') || '—'}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
