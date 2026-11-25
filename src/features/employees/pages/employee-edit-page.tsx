// Edit employee (P3-T06). Sends only the changed fields; the backend audits before/after.
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { ErrorState } from '@/components/feedback/error-state'
import { CardSkeleton } from '@/components/feedback/loading-skeletons'
import { PageHeader } from '@/components/shared/page-header'
import { useCurrentUser } from '@/features/authentication'
import { userMessage } from '@/services/api'
import { useEmployee, useUpdateEmployee } from '../api/use-employees'
import { useEmployeeLookups } from '../api/use-employee-lookups'
import { EmployeeForm } from '../components/employee-form'
import { diffEmployee } from '../lib/employee-diff'
import { employeeToFormValues } from '../schemas/employee.schema'

export function EmployeeEditPage() {
  const { employeeId = '' } = useParams()
  const user = useCurrentUser()
  const navigate = useNavigate()
  const employee = useEmployee(employeeId)
  const lookups = useEmployeeLookups()
  const update = useUpdateEmployee()

  const name = employee.data ? `${employee.data.firstName} ${employee.data.lastName}` : 'employee'

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${name}`} description="Changes are recorded in the audit history." />
      {employee.isPending || lookups.isPending ? (
        <div aria-busy="true">
          <span className="sr-only">Loading employee…</span>
          <CardSkeleton lines={4} />
        </div>
      ) : employee.isError || !lookups.data ? (
        <ErrorState
          title="Could not load this employee"
          message={userMessage(employee.error ?? lookups.error)}
          onRetry={() => {
            void employee.refetch()
            lookups.refetch()
          }}
        />
      ) : (
        <EmployeeForm
          employeeId={employee.data.id}
          defaultValues={employeeToFormValues(employee.data)}
          lookups={lookups.data}
          isOwnRecord={employee.data.id === user.id}
          submitLabel="Save changes"
          onCancel={() => void navigate(`/employees/${employee.data.id}`)}
          onSubmit={async (values) => {
            const patch = diffEmployee(employee.data, values)
            if (Object.keys(patch).length === 0) {
              toast.info('No changes to save.')
              return
            }
            await update.mutateAsync({ id: employee.data.id, patch })
            toast.success('Changes saved.')
            await navigate(`/employees/${employee.data.id}`)
          }}
        />
      )}
    </div>
  )
}
