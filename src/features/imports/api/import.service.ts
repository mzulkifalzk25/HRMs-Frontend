// ImportService contract (P7-T02). The backend reads the uploaded file, validates rows against
// existing data, and runs the import in one transaction per job (D-096). A dry run is required
// before execution and never changes data; existing records are never overwritten silently.
import type { ColumnMapping, ImportType } from '../lib/import-definitions'
import type { ImportJob, ImportRun, RowResult } from '../schemas/import.schema'

type Options = { signal?: AbortSignal }

export interface ImportService {
  /** Upload (multipart). 400 on type/size; returns detected columns and preview rows. */
  create(type: ImportType, file: File): Promise<ImportJob>
  list(options?: Options): Promise<ImportJob[]>
  get(id: string, options?: Options): Promise<ImportJob>
  /** Last dry-run or execution results, row by row. */
  rows(id: string, options?: Options): Promise<RowResult[]>
  /** 400 on mapping problems. Changes nothing. */
  dryRun(id: string, input: { mapping: ColumnMapping; updateExisting: boolean }): Promise<ImportRun>
  /** 409 `dry_run_required` without a dry run; 409 `already_executed` the second time. */
  execute(id: string): Promise<ImportRun>
}
