import { PageHeader } from '@/components/shared/page-header'
import { ROLE_LABELS, useCurrentUser } from '@/features/authentication'

export function DashboardHeader({ description }: { description: string }) {
  const user = useCurrentUser()
  return (
    <PageHeader
      title={`Welcome back, ${user.firstName}`}
      description={`${ROLE_LABELS[user.role]} dashboard · ${description}`}
    />
  )
}
