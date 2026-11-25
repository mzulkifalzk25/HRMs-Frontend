// Create employee (P3-T05). HR only (UX); the backend refuses others (403). Creating the record
// sends an invitation to set a password (D-043) instead of HR choosing a password.
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ErrorState } from '@/components/feedback/error-state'
import { CardSkeleton } from '@/components/feedback/loading-skeletons'
import { PageHeader } from '@/components/shared/page-header'
import { userMessage } from '@/services/api'
import { services } from '@/services/registry'
import { useCreateEmployee } from '../api/use-employees'
import { useEmployeeLookups } from '../api/use-employee-lookups'
import { EmployeeForm } from '../components/employee-form'
import { EMPTY_EMPLOYEE_FORM } from '../schemas/employee.schema'

export function EmployeeCreatePage() {
  const navigate = useNavigate()
  const lookups = useEmployeeLookups()
  const create = useCreateEmployee()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add employee"
        description="The person receives an email invitation to set their password and activate the account."
      />
      {lookups.isPending ? (
        <div aria-busy="true">
          <span className="sr-only">Loading form…</span>
          <CardSkeleton lines={4} />
        </div>
      ) : !lookups.data ? (
        <ErrorState
          title="Could not load the form"
          message={userMessage(lookups.error)}
          onRetry={lookups.refetch}
        />
      ) : (
        <EmployeeForm
          defaultValues={EMPTY_EMPLOYEE_FORM}
          lookups={lookups.data}
          submitLabel="Create employee and send invitation"
          onCancel={() => void navigate('/employees')}
          onSubmit={async (values) => {
            const created = await create.mutateAsync(values)
            toast.success(`${created.firstName} ${created.lastName} was added.`, {
              description:
                services.mode === 'mock'
                  ? 'Mock mode: no invitation email is actually sent.'
                  : `An invitation was sent to ${created.email}.`,
            })
            await navigate(`/employees/${created.id}`)
          }}
        />
      )}
    </div>
  )
}
