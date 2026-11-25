// Current-user profile (P2-T09). Read-only basics; editable fields are decided in Phase 3.
import { PageHeader } from '@/components/shared/page-header'
import { SectionCard } from '@/components/shared/section-card'
import { UserAvatar } from '@/components/shared/user-avatar'
import { useCurrentUser } from '../session/auth-context'
import { fullName, initials, ROLE_LABELS } from '../types'

export function ProfilePage() {
  const user = useCurrentUser()
  const rows: Array<[string, string]> = [
    ['Full name', fullName(user)],
    ['Work email', user.email],
    ['Role', ROLE_LABELS[user.role]],
    ['Employee ID', user.employeeCode ?? 'Not assigned'],
    ['Designation', user.designation ?? 'Not set'],
    ['Department', user.department ?? 'Not set'],
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="My profile"
        description="Your account details. Contact HR to change them."
      />
      <SectionCard
        title="Account"
        className="max-w-2xl"
        actions={<UserAvatar initials={initials(user)} className="size-10 text-sm" />}
      >
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="space-y-0.5">
              <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
              <dd className="text-sm break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </SectionCard>
    </div>
  )
}
