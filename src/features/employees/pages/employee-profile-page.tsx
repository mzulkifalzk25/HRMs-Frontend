// Employee profile (P3-T04) with HR actions: edit, deactivate/reactivate (P3-T07).
import { Pencil, Power, UserX } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { EmptyState } from '@/components/feedback/empty-state'
import { ErrorState } from '@/components/feedback/error-state'
import { CardSkeleton } from '@/components/feedback/loading-skeletons'
import { PageHeader } from '@/components/shared/page-header'
import { SectionCard } from '@/components/shared/section-card'
import { Button } from '@/components/ui/button'
import { ROLE_LABELS, useCurrentUser } from '@/features/authentication'
import { formatDateKey } from '@/lib/datetime'
import { ApiError, userMessage } from '@/services/api'
import { useEmployee, useSetEmployeeActive } from '../api/use-employees'
import { useEmployeeLookups } from '../api/use-employee-lookups'
import { EmployeeStatusBadge } from '../components/employee-status-badge'
import { EMPLOYEE_POLICY } from '../lib/employee-policy'

function Details({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="space-y-0.5">
          <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
          <dd className="text-sm break-words">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function EmployeeProfilePage() {
  const { employeeId = '' } = useParams()
  const user = useCurrentUser()
  const employee = useEmployee(employeeId)
  const lookups = useEmployeeLookups()
  const setActive = useSetEmployeeActive()
  const [dialog, setDialog] = useState<'deactivate' | 'activate' | null>(null)

  if (employee.isPending || lookups.isPending) {
    return (
      <div aria-busy="true" className="space-y-4">
        <span className="sr-only">Loading employee…</span>
        <CardSkeleton lines={4} />
        <CardSkeleton lines={3} />
      </div>
    )
  }
  if (employee.isError && employee.error instanceof ApiError && employee.error.status === 404) {
    return (
      <div className="space-y-6">
        <PageHeader title="Employee not found" />
        <EmptyState
          icon={UserX}
          title="This employee does not exist or is outside your scope"
          action={
            <Button asChild variant="outline">
              <Link to="/employees">Back to employees</Link>
            </Button>
          }
        />
      </div>
    )
  }
  if (employee.isError || !lookups.data) {
    return (
      <ErrorState
        title="Could not load this employee"
        message={userMessage(employee.error ?? lookups.error)}
        onRetry={() => {
          void employee.refetch()
          lookups.refetch()
        }}
      />
    )
  }

  const e = employee.data
  const { departments, designations, teams, projects, people } = lookups.data
  const name = `${e.firstName} ${e.lastName}`
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? 'Unknown person'
  const isHr = user.role === 'hr_admin'
  const isSelf = e.id === user.id
  const canChangeStatus = isHr && (!isSelf || EMPLOYEE_POLICY.hrCanChangeOwnRoleOrStatus)
  const directReports = people.filter((p) => p.managerIds.includes(e.id))

  return (
    <div className="space-y-6">
      <PageHeader
        title={name}
        description={[
          designations.find((d) => d.id === e.designationId)?.title,
          ROLE_LABELS[e.role],
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          isHr ? (
            <>
              <Button asChild variant="outline">
                <Link to={`/employees/${e.id}/edit`}>
                  <Pencil aria-hidden="true" />
                  Edit
                </Link>
              </Button>
              {canChangeStatus ? (
                e.status === 'inactive' ? (
                  <Button variant="outline" onClick={() => setDialog('activate')}>
                    <Power aria-hidden="true" />
                    Reactivate
                  </Button>
                ) : (
                  <Button variant="destructive" onClick={() => setDialog('deactivate')}>
                    <Power aria-hidden="true" />
                    Deactivate
                  </Button>
                )
              ) : null}
            </>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <EmployeeStatusBadge status={e.status} />
        {e.status === 'inactive' && e.deactivationReason ? (
          <span className="text-sm text-muted-foreground">Reason: {e.deactivationReason}</span>
        ) : null}
        {e.status === 'invited' ? (
          <span className="text-sm text-muted-foreground">
            Waiting for the person to accept the invitation.
          </span>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Work information">
          <Details
            rows={[
              ['Employee ID', e.employeeCode ?? 'Assigned when the account is activated'],
              ['Work email', e.email],
              ['Phone', e.phone ?? 'Not provided'],
              ['Department', departments.find((d) => d.id === e.departmentId)?.name ?? 'Not set'],
              [
                'Designation',
                designations.find((d) => d.id === e.designationId)?.title ?? 'Not set',
              ],
              ['Role', ROLE_LABELS[e.role]],
              ['Joining date', formatDateKey(e.joiningDate)],
            ]}
          />
        </SectionCard>
        <SectionCard title="Reporting">
          <Details
            rows={[
              [
                'Reports to',
                e.managerIds.length > 0
                  ? e.managerIds.map(nameOf).join(', ')
                  : 'No manager (leave requests go to HR)',
              ],
              [
                'Direct reports',
                directReports.length > 0 ? directReports.map((p) => p.name).join(', ') : 'None',
              ],
              [
                'Teams',
                e.teamIds.map((id) => teams.find((t) => t.id === id)?.name ?? id).join(', ') ||
                  'None',
              ],
              [
                'Projects',
                e.projectIds
                  .map((id) => projects.find((p) => p.id === id)?.name ?? id)
                  .join(', ') || 'None',
              ],
            ]}
          />
        </SectionCard>
      </div>

      <ConfirmDialog
        open={dialog === 'deactivate'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Deactivate ${name}?`}
        description="They will no longer be able to sign in. Their records are kept; nothing is deleted. You can reactivate the account later."
        confirmLabel="Deactivate"
        destructive
        reason={
          EMPLOYEE_POLICY.deactivationReasonRequired
            ? {
                label: 'Reason for deactivation',
                placeholder: 'For example: resigned, last working day 30 Nov',
                minLength: EMPLOYEE_POLICY.deactivationReasonMinLength,
              }
            : undefined
        }
        isPending={setActive.isPending}
        onConfirm={(reason) =>
          setActive.mutate(
            { id: e.id, active: false, reason },
            {
              onSuccess: () => {
                setDialog(null)
                toast.success(`${name} was deactivated.`)
              },
              onError: (error) => toast.error(userMessage(error)),
            },
          )
        }
      />
      <ConfirmDialog
        open={dialog === 'activate'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Reactivate ${name}?`}
        description="They will be able to sign in again with their existing account."
        confirmLabel="Reactivate"
        isPending={setActive.isPending}
        onConfirm={() =>
          setActive.mutate(
            { id: e.id, active: true },
            {
              onSuccess: () => {
                setDialog(null)
                toast.success(`${name} was reactivated.`)
              },
              onError: (error) => toast.error(userMessage(error)),
            },
          )
        }
      />
    </div>
  )
}
