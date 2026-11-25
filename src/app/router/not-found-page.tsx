import { SearchX } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/feedback/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Page not found" />
      <EmptyState
        icon={SearchX}
        title="This page does not exist"
        description="The link may be wrong, or the page may belong to a module that is not built yet."
        action={
          <Button asChild variant="outline">
            <Link to="/">Go to overview</Link>
          </Button>
        }
      />
    </div>
  )
}
