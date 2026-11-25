// Shared list for departments, designations, teams and projects: status, details, and HR actions
// (edit, deactivate/reactivate with confirmation). Nothing can be deleted (R-008).
import { Pencil, Power } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { EmptyState } from '@/components/feedback/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { userMessage } from '@/services/api'
import { useSetOrgRecordStatus, type OrgEntity } from '../api/use-organization'
import type { RecordStatus } from '../schemas/organization.schema'

export type OrgRow = {
  id: string
  title: string
  details: ReactNode
  status: RecordStatus
  /** Extra warning in the deactivate dialog, e.g. "12 active employees are in this department." */
  deactivateWarning?: string
}

type OrgRecordListProps = {
  entity: OrgEntity
  /** Singular noun for messages, e.g. "department". */
  noun: string
  rows: OrgRow[]
  canManage: boolean
  onEdit: (id: string) => void
}

export function OrgRecordList({ entity, noun, rows, canManage, onEdit }: OrgRecordListProps) {
  const setStatus = useSetOrgRecordStatus()
  const [target, setTarget] = useState<OrgRow | null>(null)

  if (rows.length === 0) {
    return (
      <EmptyState
        title={`No ${noun}s yet`}
        description={canManage ? `Add the first ${noun}.` : undefined}
        className="py-8"
      />
    )
  }

  const deactivating = target?.status === 'active'

  return (
    <>
      <ul className="divide-y">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-0.5">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {row.title}
                {row.status === 'inactive' ? (
                  <StatusBadge tone="neutral">Inactive</StatusBadge>
                ) : null}
              </p>
              <div className="text-xs text-muted-foreground">{row.details}</div>
            </div>
            {canManage ? (
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(row.id)}
                  aria-label={`Edit ${row.title}`}
                >
                  <Pencil aria-hidden="true" />
                  Edit
                </Button>
                <Button
                  variant={row.status === 'active' ? 'ghost' : 'outline'}
                  size="sm"
                  onClick={() => setTarget(row)}
                  aria-label={`${row.status === 'active' ? 'Deactivate' : 'Reactivate'} ${row.title}`}
                >
                  <Power aria-hidden="true" />
                  {row.status === 'active' ? 'Deactivate' : 'Reactivate'}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
        title={`${deactivating ? 'Deactivate' : 'Reactivate'} ${target?.title ?? ''}?`}
        description={
          deactivating
            ? `It will no longer be available for new assignments. Existing records keep their history; nothing is deleted.${target?.deactivateWarning ? ` ${target.deactivateWarning}` : ''}`
            : 'It will be available for assignments again.'
        }
        confirmLabel={deactivating ? 'Deactivate' : 'Reactivate'}
        destructive={deactivating}
        isPending={setStatus.isPending}
        onConfirm={() => {
          if (!target) return
          setStatus.mutate(
            { entity, id: target.id, status: deactivating ? 'inactive' : 'active' },
            {
              onSuccess: () => {
                toast.success(
                  `${target.title} was ${deactivating ? 'deactivated' : 'reactivated'}.`,
                )
                setTarget(null)
              },
              onError: (error) => toast.error(userMessage(error)),
            },
          )
        }}
      />
    </>
  )
}
