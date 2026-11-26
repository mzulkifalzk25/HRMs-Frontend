// In-memory audit log for mock mode (P8-T17, D-080). Append-only: entries are only added by the
// other mock stores when an action really happens in this session; nothing is seeded, so the log
// never claims actions that did not happen. HR only (provisional, Q-AUD-01).
import type { AuditEntry, AuditQuery } from '@/features/audit/schemas/audit.schema'
import { appDateKey, toAppIsoString } from '@/lib/datetime'
import { ApiError } from '@/services/api'
import type { Page } from '@/types/api'
import { getMockViewer } from './mock-session'

export type AuditInput = Omit<AuditEntry, 'id' | 'at' | 'reason' | 'before' | 'after'> & {
  reason?: string | null
  before?: Record<string, string> | null
  after?: Record<string, string> | null
}

export function createAuditStore(options: { now?: () => Date } = {}) {
  const now = options.now ?? (() => new Date())
  let entries: AuditEntry[] = []
  let counter = 0

  function requireHr() {
    const v = getMockViewer()
    if (!v)
      throw new ApiError({
        status: 401,
        code: 'unauthorized',
        message: 'Your session has expired. Please sign in again.',
      })
    if (v.role !== 'hr_admin')
      throw new ApiError({
        status: 403,
        code: 'forbidden',
        message: 'You do not have permission to do this.',
      })
  }

  return {
    reset() {
      entries = []
      counter = 0
    },
    record(input: AuditInput): void {
      counter += 1
      entries.push(
        Object.freeze({
          ...input,
          id: `aud-${counter}`,
          at: toAppIsoString(now()),
          reason: input.reason ?? null,
          before: input.before ? { ...input.before } : null,
          after: input.after ? { ...input.after } : null,
        }),
      )
    },
    list(query: AuditQuery): Page<AuditEntry> {
      requireHr()
      let rows = entries.filter(
        (e) =>
          (!query.actorId || e.actorId === query.actorId) &&
          (!query.action || e.action === query.action) &&
          (!query.entity || e.entity === query.entity) &&
          (!query.from || appDateKey(e.at) >= query.from) &&
          (!query.to || appDateKey(e.at) <= query.to),
      )
      rows = [...rows].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
      if (query.sort !== 'oldest') rows.reverse()
      const start = (query.page - 1) * query.pageSize
      return {
        count: rows.length,
        next: start + query.pageSize < rows.length ? `?page=${query.page + 1}` : null,
        previous: query.page > 1 ? `?page=${query.page - 1}` : null,
        results: rows.slice(start, start + query.pageSize),
      }
    },
    /** Everyone who appears as an actor (for the filter). */
    actors(): Array<{ id: string; name: string }> {
      requireHr()
      const map = new Map(entries.map((e) => [e.actorId, e.actorName]))
      return [...map]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },
  }
}

export type AuditStore = ReturnType<typeof createAuditStore>
export const mockAuditStore = createAuditStore()
