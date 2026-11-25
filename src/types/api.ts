// Shared API envelope types (docs/API_INTEGRATION.md §5).
import { z, type ZodType } from 'zod'

/** DRF PageNumberPagination response. `next`/`previous` are opaque URLs (unused by the UI). */
export type Page<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export function pageSchema<T>(item: ZodType<T>) {
  return z.object({
    count: z.number().int().nonnegative(),
    next: z.string().nullable(),
    previous: z.string().nullable(),
    results: z.array(item),
  })
}

export type SortDirection = 'asc' | 'desc'

/** DRF `ordering` value: `field` or `-field`. */
export function toOrdering(field: string, direction: SortDirection): string {
  return direction === 'desc' ? `-${field}` : field
}

export function fromOrdering(
  ordering: string | null | undefined,
): { field: string; direction: SortDirection } | null {
  if (!ordering) return null
  return ordering.startsWith('-')
    ? { field: ordering.slice(1), direction: 'desc' }
    : { field: ordering, direction: 'asc' }
}
