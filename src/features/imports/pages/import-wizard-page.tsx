// New import (P7-T03…T09): 1 upload → 2 preview and column mapping → 3 dry run review → import.
// The dry run is required and changes nothing; existing records are only changed when "update
// existing records" was chosen (D-071, D-096). The backend reads the file; in mock mode the
// preview shows sample rows.
import { AlertTriangle, ArrowLeft, FileUp, Play } from 'lucide-react'
import { useId, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { ErrorState } from '@/components/feedback/error-state'
import { CardSkeleton } from '@/components/feedback/loading-skeletons'
import { NativeSelect } from '@/components/forms/native-select'
import { PageHeader } from '@/components/shared/page-header'
import { SectionCard } from '@/components/shared/section-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ApiError, userMessage } from '@/services/api'
import {
  useCreateImport,
  useDryRun,
  useExecuteImport,
  useImportJob,
  useImportRows,
} from '../api/use-imports'
import { ImportCounts, ImportResults } from '../components/import-results'
import {
  fileProblem,
  IMPORT_FIELDS,
  IMPORT_LIMITS,
  IMPORT_TYPE_LABELS,
  IMPORT_TYPES,
  mappingProblems,
  suggestMapping,
  UPDATE_ALLOWED,
  type ColumnMapping,
  type ImportType,
} from '../lib/import-definitions'
import type { ImportJob } from '../schemas/import.schema'

export function ImportWizardPage() {
  const [params, setParams] = useSearchParams()
  const jobId = params.get('job')
  return (
    <div className="space-y-6">
      <PageHeader
        title="New import"
        description="Upload an Excel file, match its columns, check the dry run, then import. Nothing changes before the last step."
      />
      {jobId ? (
        <JobSteps key={jobId} jobId={jobId} />
      ) : (
        <UploadStep onUploaded={(id) => setParams({ job: id })} />
      )}
    </div>
  )
}

function UploadStep({ onUploaded }: { onUploaded: (id: string) => void }) {
  const [type, setType] = useState<ImportType>('employees')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const create = useCreateImport()
  const ids = { type: useId(), file: useId() }

  async function upload() {
    const problem = file ? fileProblem(file) : 'Choose a file.'
    setError(problem)
    if (problem || !file) return
    try {
      const job = await create.mutateAsync({ type, file })
      onUploaded(job.id)
    } catch (e) {
      setError(e instanceof ApiError ? (e.fieldErrors.file?.[0] ?? userMessage(e)) : userMessage(e))
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <SectionCard title="1. Upload" className="lg:col-span-2">
        <div className="space-y-4">
          <div className="max-w-sm space-y-1.5">
            <Label htmlFor={ids.type}>What are you importing?</Label>
            <NativeSelect
              id={ids.type}
              value={type}
              options={IMPORT_TYPES.map((t) => ({ value: t, label: IMPORT_TYPE_LABELS[t] }))}
              onChange={(e) => setType(e.target.value as ImportType)}
            />
          </div>
          <div className="max-w-sm space-y-1.5">
            <Label htmlFor={ids.file}>Excel file</Label>
            <Input
              id={ids.file}
              type="file"
              accept={IMPORT_LIMITS.extensions.join(',')}
              aria-invalid={Boolean(error)}
              aria-describedby={`${ids.file}-hint`}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                setError(null)
              }}
            />
            <p id={`${ids.file}-hint`} className="text-xs text-muted-foreground">
              .xlsx or .xls, up to 10 MB and 5,000 rows. Files are read by the server, never run in
              your browser.
            </p>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <Button onClick={() => void upload()} disabled={create.isPending}>
            <FileUp aria-hidden="true" />
            {create.isPending ? 'Uploading…' : 'Upload and preview'}
          </Button>
        </div>
      </SectionCard>
      <SectionCard title="Columns" description={IMPORT_TYPE_LABELS[type]}>
        <ul className="space-y-1.5 text-sm" aria-label="Expected columns">
          {IMPORT_FIELDS[type].map((f) => (
            <li key={f.key}>
              <span className="font-medium">{f.label}</span>
              {f.required ? <span className="text-destructive"> *</span> : ' (optional)'}
              {f.hint ? (
                <span className="block text-xs text-muted-foreground">{f.hint}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  )
}

function JobSteps({ jobId }: { jobId: string }) {
  const job = useImportJob(jobId)
  if (job.isPending) return <CardSkeleton lines={4} />
  if (job.isError)
    return <ErrorState message={userMessage(job.error)} onRetry={() => void job.refetch()} />
  return <MappingAndReview job={job.data} />
}

function MappingAndReview({ job }: { job: ImportJob }) {
  const navigate = useNavigate()
  const dryRun = useDryRun()
  const execute = useExecuteImport()
  const rows = useImportRows(job.id, job.status === 'validated')
  const [mapping, setMapping] = useState<ColumnMapping>(
    () => job.mapping ?? suggestMapping(job.type, job.columns),
  )
  const [updateExisting, setUpdateExisting] = useState(job.updateExisting)
  const [checked, setChecked] = useState(job.status === 'validated')
  const [confirming, setConfirming] = useState(false)
  const idPrefix = useId()
  const problems = mappingProblems(job.type, mapping)
  const fields = IMPORT_FIELDS[job.type]
  const summary = job.summary

  function change(next: Partial<{ mapping: ColumnMapping; updateExisting: boolean }>) {
    if (next.mapping) setMapping(next.mapping)
    if (next.updateExisting !== undefined) setUpdateExisting(next.updateExisting)
    setChecked(false) // any change needs a new dry run
  }

  async function runDry() {
    try {
      await dryRun.mutateAsync({ id: job.id, mapping, updateExisting })
      setChecked(true)
    } catch (e) {
      toast.error(userMessage(e))
    }
  }

  async function runImport() {
    try {
      const result = await execute.mutateAsync(job.id)
      toast.success(
        `Import finished: ${result.job.summary?.create ?? 0} created, ${result.job.summary?.update ?? 0} updated.`,
      )
      void navigate(`/imports/${job.id}`)
    } catch (e) {
      toast.error(userMessage(e))
    } finally {
      setConfirming(false)
    }
  }

  if (job.status === 'completed' || job.status === 'failed') {
    return <Navigate to={`/imports/${job.id}`} replace />
  }

  return (
    <div className="space-y-6">
      {job.sampleData ? (
        <p
          role="note"
          className="flex items-start gap-2 rounded-md border border-warning bg-warning-subtle px-3 py-2 text-sm text-warning-subtle-foreground"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Mock mode: these are fictional sample rows for “{job.fileName}”. The backend reads your
          actual file. Imports into the mock data are lost on reload.
        </p>
      ) : null}

      <SectionCard
        title="2. Preview and columns"
        description={`${IMPORT_TYPE_LABELS[job.type]} · ${job.fileName} · ${job.totalRows} rows (first ${job.previewRows.length} shown)`}
        actions={
          <Button variant="ghost" size="sm" onClick={() => void navigate('/imports/new')}>
            <ArrowLeft aria-hidden="true" />
            Another file
          </Button>
        }
      >
        <div className="space-y-6">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <caption className="sr-only">File preview</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  {job.columns.map((c) => (
                    <TableHead key={c}>{c}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {job.previewRows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="tabular-nums text-muted-foreground">{i + 2}</TableCell>
                    {job.columns.map((c, j) => (
                      <TableCell key={c} className="whitespace-nowrap">
                        {row[j] || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-medium">Match the columns</legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map((f) => {
                const id = `${idPrefix}-${f.key}`
                return (
                  <div key={f.key} className="space-y-1.5">
                    <Label htmlFor={id}>
                      {f.label}
                      {f.required ? <span className="text-destructive"> *</span> : null}
                    </Label>
                    <NativeSelect
                      id={id}
                      placeholder="Not in this file"
                      value={mapping[f.key] ?? ''}
                      aria-invalid={Boolean(problems[f.key])}
                      options={job.columns.map((c) => ({ value: c, label: c }))}
                      onChange={(e) =>
                        change({ mapping: { ...mapping, [f.key]: e.target.value || null } })
                      }
                    />
                    {problems[f.key] ? (
                      <p className="text-xs text-destructive">{problems[f.key]}</p>
                    ) : f.hint ? (
                      <p className="text-xs text-muted-foreground">{f.hint}</p>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </fieldset>

          {UPDATE_ALLOWED[job.type] ? (
            <div className="flex items-start gap-2">
              <input
                id={`${idPrefix}-update`}
                type="checkbox"
                className="mt-1 size-4 accent-primary"
                checked={updateExisting}
                onChange={(e) => change({ updateExisting: e.target.checked })}
              />
              <div>
                <label htmlFor={`${idPrefix}-update`} className="text-sm font-medium">
                  Update existing records
                </label>
                <p className="text-xs text-muted-foreground">
                  Off: records that already exist are skipped. On: they are changed, and the dry run
                  shows every change before you import.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Existing records are never changed by this import; matching rows are skipped.
            </p>
          )}

          <Button
            onClick={() => void runDry()}
            disabled={Object.keys(problems).length > 0 || dryRun.isPending}
          >
            {dryRun.isPending ? 'Checking…' : 'Run dry run'}
          </Button>
        </div>
      </SectionCard>

      {checked && summary ? (
        <SectionCard title="3. Dry run" description="Nothing has been changed yet.">
          <div className="space-y-5">
            <ImportCounts summary={summary} done={false} />
            {rows.isPending ? (
              <CardSkeleton lines={3} />
            ) : rows.isError ? (
              <ErrorState message={userMessage(rows.error)} onRetry={() => void rows.refetch()} />
            ) : (
              <ImportResults rows={rows.data} fileName={job.fileName} />
            )}
            <Button
              onClick={() => setConfirming(true)}
              disabled={summary.create + summary.update === 0 || execute.isPending}
            >
              <Play aria-hidden="true" />
              Import {summary.create + summary.update} rows
            </Button>
          </div>
        </SectionCard>
      ) : null}

      {summary ? (
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title="Run this import?"
          description={`${summary.create} records will be created and ${summary.update} updated. ${summary.skip} rows are skipped and ${summary.error} have errors. The import runs once and is recorded in the history.`}
          confirmLabel="Import"
          isPending={execute.isPending}
          onConfirm={() => void runImport()}
        />
      ) : null}
    </div>
  )
}
