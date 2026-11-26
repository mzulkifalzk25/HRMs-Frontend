import type { StatusTone } from '@/components/shared/status-badge'
import type { ImportJob } from '../schemas/import.schema'

export const IMPORT_STATUS: Record<ImportJob['status'], [label: string, tone: StatusTone]> = {
  uploaded: ['Uploaded, not checked', 'neutral'],
  validated: ['Dry run done, not imported', 'warning'],
  completed: ['Imported', 'success'],
  failed: ['Nothing imported', 'danger'],
}
