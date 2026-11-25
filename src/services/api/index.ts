// Shared API client instance for HTTP service implementations (`*.http.ts`).
import { env } from '@/lib/env'
import { createHttpClient } from './http-client'

export { ApiError, apiErrorFromResponse, GENERIC_ERROR_MESSAGE, userMessage } from './api-error'
export type { ApiErrorCode, FieldErrors } from './api-error'
export { buildUrl, createHttpClient, DEFAULT_TIMEOUT_MS } from './http-client'
export type { AuthHooks, HttpClient, HttpMethod, QueryParams, RequestOptions } from './http-client'

export const apiClient = createHttpClient({ baseUrl: env.apiBaseUrl })
