// One import (P7-T10, P7-T11): what was imported, by whom and when, row results, error report.
import { Link, useParams } from 'react-router'
import { ErrorState } from '@/components/feedback/error-state'
import { CardSkeleton } from '@/components/feedback/loading-skeletons'
import { PageHeader } from '@/components/shared/page-header'
import { SectionCard } from '@/components/shared/section-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { formatAppDateTime } from '@/lib/datetime'
import { userMessage } from '@/services/api'
import { useImportJob, useImportRows } from '../api/use-imports'
import { ImportCounts, ImportResults } from '../components/import-results'
import { IMPORT_TYPE_LABELS } from '../lib/import-definitions'
import { IMPORT_STATUS } from '../lib/import-status'

export function ImportDetailPage() {
  const { importId = '' } = useParams()
  const job = useImportJob(importId)
  const rows = useImportRows(importId, true)
  if (job.isPending) return <CardSkeleton lines={4} />
  if (job.isError)
    return (
      <ErrorState
        title="Could not load this import"
        message={userMessage(job.error)}
        onRetry={() => void job.refetch()}
      />
    )
  const j = job.data
  const [label, tone] = IMPORT_STATUS[j.status]
  return (
    <div className="space-y-6">
      <PageHeader
        title={`${IMPORT_TYPE_LABELS[j.type]} import`}
        description={`${j.fileName} · uploaded ${formatAppDateTime(j.createdAt)} by ${j.createdByName}${j.executedAt ? ` · imported ${formatAppDateTime(j.executedAt)}` : ''}`}
        actions={
          <Button asChild variant="outline">
            <Link to="/imports">All imports</Link>
          </Button>
        }
      />
      <SectionCard title="Result" actions={<StatusBadge tone={tone}>{label}</StatusBadge>}>
        <div className="space-y-5">
          {j.summary ? (
            <ImportCounts
              summary={j.summary}
              done={j.status === 'completed' || j.status === 'failed'}
            />
          ) : null}
          {rows.isPending ? (
            <CardSkeleton lines={3} />
          ) : rows.isError ? (
            <ErrorState message={userMessage(rows.error)} onRetry={() => void rows.refetch()} />
          ) : (
            <ImportResults rows={rows.data} fileName={j.fileName} />
          )}
        </div>
      </SectionCard>
    </div>
  )
}
