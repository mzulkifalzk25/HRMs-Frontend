// Audit log (P8-T17…T19): read-only, HR only (provisional Q-AUD-01). Filters by actor, action,
// entity and date; newest or oldest first; a detail view shows before → after.
import { Eye, ShieldCheck } from 'lucide-react'
import { useId, useState } from 'react'
import { EmptyState } from '@/components/feedback/empty-state'
import { ErrorState } from '@/components/feedback/error-state'
import { ListSkeleton } from '@/components/feedback/loading-skeletons'
import { NativeSelect } from '@/components/forms/native-select'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { PaginationBar } from '@/components/tables/pagination-bar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatAppDateTime } from '@/lib/datetime'
import { userMessage } from '@/services/api'
import { services } from '@/services/registry'
import { useAuditActors, useAuditLog } from '../api/use-audit'
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTIONS,
  AUDIT_ENTITIES,
  AUDIT_ENTITY_LABELS,
  type AuditEntry,
  type AuditQuery,
} from '../schemas/audit.schema'

const PAGE_SIZES = [25, 50, 100] as const

export function AuditPage() {
  const [query, setQuery] = useState<AuditQuery>({ page: 1, pageSize: 25, sort: 'newest' })
  const log = useAuditLog(query)
  const actors = useAuditActors()
  const [open, setOpen] = useState<AuditEntry | null>(null)
  const ids = {
    actor: useId(),
    action: useId(),
    entity: useId(),
    from: useId(),
    to: useId(),
    sort: useId(),
  }
  const update = (c: Partial<AuditQuery>) => setQuery((q) => ({ ...q, page: 1, ...c }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Who changed what and when. Entries cannot be edited or deleted."
      />
      {services.mode === 'mock' ? (
        <p
          role="note"
          className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
        >
          Mock data: only actions performed in this browser session are listed. Sample data that
          came with the demo has no audit history, and the log resets on reload.
        </p>
      ) : null}
      <section
        aria-label="Filters"
        className="grid gap-3 rounded-lg border bg-card p-4 shadow-xs sm:grid-cols-3 lg:grid-cols-6"
      >
        <div className="space-y-1.5">
          <Label htmlFor={ids.actor}>Actor</Label>
          <NativeSelect
            id={ids.actor}
            placeholder="Anyone"
            value={query.actorId ?? ''}
            options={(actors.data ?? []).map((a) => ({ value: a.id, label: a.name }))}
            onChange={(e) => update({ actorId: e.target.value || undefined })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.action}>Action</Label>
          <NativeSelect
            id={ids.action}
            placeholder="All actions"
            value={query.action ?? ''}
            options={AUDIT_ACTIONS.map((a) => ({ value: a, label: AUDIT_ACTION_LABELS[a] }))}
            onChange={(e) =>
              update({ action: (e.target.value || undefined) as AuditQuery['action'] })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.entity}>Entity</Label>
          <NativeSelect
            id={ids.entity}
            placeholder="All entities"
            value={query.entity ?? ''}
            options={AUDIT_ENTITIES.map((a) => ({ value: a, label: AUDIT_ENTITY_LABELS[a] }))}
            onChange={(e) =>
              update({ entity: (e.target.value || undefined) as AuditQuery['entity'] })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.from}>From</Label>
          <Input
            id={ids.from}
            type="date"
            value={query.from ?? ''}
            onChange={(e) => update({ from: e.target.value || undefined })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.to}>To</Label>
          <Input
            id={ids.to}
            type="date"
            value={query.to ?? ''}
            onChange={(e) => update({ to: e.target.value || undefined })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.sort}>Order</Label>
          <NativeSelect
            id={ids.sort}
            value={query.sort ?? 'newest'}
            options={[
              { value: 'newest', label: 'Newest first' },
              { value: 'oldest', label: 'Oldest first' },
            ]}
            onChange={(e) => update({ sort: e.target.value as AuditQuery['sort'] })}
          />
        </div>
      </section>
      <section aria-label="Audit entries" className="rounded-lg border bg-card shadow-xs">
        {log.isPending ? (
          <ListSkeleton rows={5} className="border-0" />
        ) : log.isError ? (
          <div className="p-4">
            <ErrorState
              title="Could not load the audit log"
              message={userMessage(log.error)}
              onRetry={() => void log.refetch()}
            />
          </div>
        ) : log.data.results.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={ShieldCheck}
              title="No audit entries"
              description="Changes to employees, attendance, leave, imports and settings appear here."
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <caption className="sr-only">Audit entries</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Record</TableHead>
                    <TableHead>
                      <span className="sr-only">Details</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {log.data.results.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap">{formatAppDateTime(e.at)}</TableCell>
                      <TableCell>{e.actorName}</TableCell>
                      <TableCell>
                        <StatusBadge tone="info">{AUDIT_ACTION_LABELS[e.action]}</StatusBadge>
                      </TableCell>
                      <TableCell>{AUDIT_ENTITY_LABELS[e.entity]}</TableCell>
                      <TableCell className="max-w-72 truncate">{e.entityLabel}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setOpen(e)}
                          aria-label={`Details of ${AUDIT_ACTION_LABELS[e.action]} ${e.entityLabel}`}
                        >
                          <Eye aria-hidden="true" />
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <PaginationBar
              page={query.page}
              pageSize={query.pageSize}
              total={log.data.count}
              pageSizes={PAGE_SIZES}
              itemLabel="entries"
              onPageChange={(page) => setQuery((q) => ({ ...q, page }))}
              onPageSizeChange={(pageSize) => update({ pageSize })}
            />
          </>
        )}
      </section>
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="sm:max-w-lg">
          {open ? <AuditDetail entry={open} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AuditDetail({ entry }: { entry: AuditEntry }) {
  const fields = [
    ...new Set([...Object.keys(entry.before ?? {}), ...Object.keys(entry.after ?? {})]),
  ]
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>
          {AUDIT_ACTION_LABELS[entry.action]}: {AUDIT_ENTITY_LABELS[entry.entity]}
        </DialogTitle>
        <DialogDescription>
          {entry.entityLabel} · {entry.actorName} · {formatAppDateTime(entry.at)}
        </DialogDescription>
      </DialogHeader>
      {entry.reason ? (
        <p className="rounded-md bg-muted/60 px-3 py-2 text-sm">Reason: {entry.reason}</p>
      ) : null}
      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">No field values recorded.</p>
      ) : (
        <Table>
          <caption className="sr-only">Changed values</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Field</TableHead>
              <TableHead>Before</TableHead>
              <TableHead>After</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((f) => (
              <TableRow key={f}>
                <TableCell className="font-medium">{f}</TableCell>
                <TableCell>{entry.before?.[f] ?? '—'}</TableCell>
                <TableCell>{entry.after?.[f] ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
