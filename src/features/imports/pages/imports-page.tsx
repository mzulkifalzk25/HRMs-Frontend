// Import history (P7-T10): every import with its type, file, outcome and counts.
import { FileUp, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/feedback/empty-state'
import { ErrorState } from '@/components/feedback/error-state'
import { ListSkeleton } from '@/components/feedback/loading-skeletons'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatAppDateTime } from '@/lib/datetime'
import { userMessage } from '@/services/api'
import { useImports } from '../api/use-imports'
import { IMPORT_TYPE_LABELS } from '../lib/import-definitions'
import { IMPORT_STATUS as STATUS } from '../lib/import-status'

export function ImportsPage() {
  const imports = useImports()
  return (
    <div className="space-y-6">
      <PageHeader
        title="Imports"
        description="Bring employees, historical attendance, historical leave and leave balances in from Excel. The backend reads and checks every file."
        actions={
          <Button asChild>
            <Link to="/imports/new">
              <Plus aria-hidden="true" />
              New import
            </Link>
          </Button>
        }
      />
      <section aria-label="Import history" className="rounded-lg border bg-card shadow-xs">
        {imports.isPending ? (
          <ListSkeleton rows={4} className="border-0" />
        ) : imports.isError ? (
          <div className="p-4">
            <ErrorState
              message={userMessage(imports.error)}
              onRetry={() => void imports.refetch()}
            />
          </div>
        ) : imports.data.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={FileUp}
              title="No imports yet"
              description="Start one with “New import”."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <caption className="sr-only">Import history</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Created / updated / skipped / errors</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imports.data.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatAppDateTime(job.createdAt)}
                    </TableCell>
                    <TableCell>{IMPORT_TYPE_LABELS[job.type]}</TableCell>
                    <TableCell>
                      <Link
                        to={
                          job.status === 'completed' || job.status === 'failed'
                            ? `/imports/${job.id}`
                            : `/imports/new?job=${job.id}`
                        }
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {job.fileName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={STATUS[job.status][1]}>
                        {STATUS[job.status][0]}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {job.summary
                        ? `${job.summary.create} / ${job.summary.update} / ${job.summary.skip} / ${job.summary.error}`
                        : '—'}
                    </TableCell>
                    <TableCell>{job.createdByName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}
