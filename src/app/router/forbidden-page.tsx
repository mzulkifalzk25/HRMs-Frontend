// 403 page (P2-T07). Shown by the role guard; the server would refuse the data anyway (D-027).
import { ShieldX } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/feedback/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'

export function ForbiddenPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Access denied" />
      <EmptyState
        icon={ShieldX}
        title="You do not have access to this page"
        description="This page is not available for your role. If you think this is a mistake, contact your HR administrator."
        action={
          <Button asChild variant="outline">
            <Link to="/">Go to my dashboard</Link>
          </Button>
        }
      />
    </div>
  )
}
