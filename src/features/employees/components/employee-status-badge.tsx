import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { EMPLOYEE_STATUS_LABELS, type EmployeeStatus } from '../schemas/employee.schema'

const TONE: Record<EmployeeStatus, StatusTone> = {
  active: 'success',
  invited: 'info',
  inactive: 'neutral',
}

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  return <StatusBadge tone={TONE[status]}>{EMPLOYEE_STATUS_LABELS[status]}</StatusBadge>
}
