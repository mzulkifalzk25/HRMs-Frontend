// Response helpers for HTTP services: snake_case → camelCase and contract validation.
import type { ZodType } from 'zod'
import { ApiError } from './api-error'

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_match, char: string) => char.toUpperCase())
}

/** Recursively convert object keys from snake_case (DRF) to camelCase. Values are untouched. */
export function camelizeKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelizeKeys)
  if (
    value !== null &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, inner]) => [
        snakeToCamel(key),
        camelizeKeys(inner),
      ]),
    )
  }
  return value
}

/** Camelize and validate an API body; a contract mismatch becomes `invalid_response`. */
export function parseApiResponse<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(camelizeKeys(body))
  if (!result.success) {
    throw new ApiError({
      status: 200,
      code: 'invalid_response',
      message: 'The server sent data in an unexpected format.',
      details: result.error.issues,
    })
  }
  return result.data
}
