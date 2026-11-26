// HTTP ImportService (proposed endpoints, docs/API_INTEGRATION.md §6).
import { z } from 'zod'
import { parseApiResponse, type HttpClient } from '@/services/api'
import { importJobSchema, importRunSchema, rowResultSchema } from '../schemas/import.schema'
import type { ImportService } from './import.service'

const job = (id: string, action = '') =>
  `imports/${encodeURIComponent(id)}/${action ? `${action}/` : ''}`

export function createHttpImportService(client: HttpClient): ImportService {
  return {
    async create(type, file) {
      const form = new FormData()
      form.append('type', type)
      form.append('file', file)
      return parseApiResponse(importJobSchema, await client.post('imports/', form))
    },
    async list({ signal } = {}) {
      return parseApiResponse(z.array(importJobSchema), await client.get('imports/', { signal }))
    },
    async get(id, { signal } = {}) {
      return parseApiResponse(importJobSchema, await client.get(job(id), { signal }))
    },
    async rows(id, { signal } = {}) {
      return parseApiResponse(
        z.array(rowResultSchema),
        await client.get(job(id, 'rows'), { signal }),
      )
    },
    async dryRun(id, input) {
      const body = await client.post(job(id, 'dry-run'), {
        mapping: input.mapping,
        update_existing: input.updateExisting,
      })
      return parseApiResponse(importRunSchema, body)
    },
    async execute(id) {
      return parseApiResponse(importRunSchema, await client.post(job(id, 'execute')))
    },
  }
}
