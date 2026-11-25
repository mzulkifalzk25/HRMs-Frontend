import { formatDateKey } from '@/lib/datetime'

/** `25 Nov 2026` or `25 Nov 2026 – 27 Nov 2026` for calendar date keys. */
export function dateRange(start: string, end: string): string {
  return start === end ? formatDateKey(start) : `${formatDateKey(start)} – ${formatDateKey(end)}`
}
