// Import contracts (P7-T01). The backend reads the file, validates rows against existing data and
// runs the import (D-096); the app uploads, maps columns, shows the dry run and the results.
import { z } from 'zod'
import { instantSchema } from '@/types/hr'
import { IMPORT_TYPES } from '../lib/import-definitions'

export const importTypeSchema = z.enum(IMPORT_TYPES)

export const ROW_ACTIONS = ['create', 'update', 'skip', 'error'] as const
export const rowResultSchema = z.object({
  /** Spreadsheet row number (header is row 1). */
  row: z.number().int().positive(),
  action: z.enum(ROW_ACTIONS),
  /** What identifies the row, e.g. an email or "FBX-1009 · 2026-11-20". */
  key: z.string(),
  messages: z.array(z.string()),
  /** For updates: field → [before, after]. */
  changes: z.record(z.string(), z.tuple([z.string(), z.string()])).nullable(),
})
export type RowResult = z.infer<typeof rowResultSchema>

export const importSummarySchema = z.object({
  create: z.number().int().nonnegative(),
  update: z.number().int().nonnegative(),
  skip: z.number().int().nonnegative(),
  error: z.number().int().nonnegative(),
})
export type ImportSummary = z.infer<typeof importSummarySchema>

export const IMPORT_STATUSES = ['uploaded', 'validated', 'completed', 'failed'] as const
export const importJobSchema = z.object({
  id: z.string(),
  type: importTypeSchema,
  fileName: z.string(),
  fileSize: z.number().int().nonnegative(),
  status: z.enum(IMPORT_STATUSES),
  createdAt: instantSchema,
  createdByName: z.string(),
  columns: z.array(z.string()),
  previewRows: z.array(z.array(z.string())),
  totalRows: z.number().int().nonnegative(),
  /** True in mock mode: the preview rows are fictional samples, not the uploaded file. */
  sampleData: z.boolean(),
  mapping: z.record(z.string(), z.string().nullable()).nullable(),
  updateExisting: z.boolean(),
  /** Dry-run counts (status validated) or executed counts (completed). */
  summary: importSummarySchema.nullable(),
  executedAt: instantSchema.nullable(),
})
export type ImportJob = z.infer<typeof importJobSchema>

export const importRunSchema = z.object({ job: importJobSchema, rows: z.array(rowResultSchema) })
export type ImportRun = z.infer<typeof importRunSchema>

export const ROW_ACTION_LABELS: Record<RowResult['action'], string> = {
  create: 'Create',
  update: 'Update',
  skip: 'Skip',
  error: 'Error',
}
