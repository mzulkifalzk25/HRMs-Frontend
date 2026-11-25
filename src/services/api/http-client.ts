// Centralized typed HTTP client (P1-T10, R-001, R-016: native fetch, no axios).
//
// - Base URL from configuration; paths must be relative (prevents sending auth headers to other origins).
// - JSON in/out; FormData passed through for uploads.
// - Optional Zod schema validates responses at the API boundary.
// - Timeout + caller AbortSignal; every failure becomes an ApiError.
// - Auth hooks: access-token injection and refresh-on-401 with a single shared refresh.
//   Real token storage/refresh is BLOCKED by Q-TECH-01; hooks stay unset until Phase 2.
// - Never logs requests, tokens or bodies.
import type { ZodType } from 'zod'
import { ApiError, apiErrorFromResponse } from './api-error'

export type QueryValue = string | number | boolean | null | undefined
export type QueryParams = Record<string, QueryValue | readonly QueryValue[]>

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type AuthHooks = {
  /** Current access token, or null when signed out. */
  getAccessToken?: () => string | null | undefined
  /** Try to refresh the session after a 401. Resolve `true` if requests may be retried. */
  refreshSession?: () => Promise<boolean>
  /** Called when a 401 cannot be recovered (refresh failed or unavailable). */
  onSessionExpired?: () => void
}

export type RequestOptions<T> = {
  query?: QueryParams
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
  /** Overrides the client default timeout (ms). */
  timeoutMs?: number
  /** Validates the parsed response body; a mismatch becomes `invalid_response`. */
  schema?: ZodType<T>
  /** Set `false` for public endpoints (login, password reset): no token, no refresh. */
  auth?: boolean
}

export type HttpClientConfig = {
  baseUrl: string
  timeoutMs?: number
  fetch?: typeof fetch
  auth?: AuthHooks
  credentials?: RequestCredentials
}

export type HttpClient = {
  request<T = unknown>(method: HttpMethod, path: string, options?: RequestOptions<T>): Promise<T>
  get<T = unknown>(path: string, options?: Omit<RequestOptions<T>, 'body'>): Promise<T>
  post<T = unknown>(path: string, body?: unknown, options?: RequestOptions<T>): Promise<T>
  put<T = unknown>(path: string, body?: unknown, options?: RequestOptions<T>): Promise<T>
  patch<T = unknown>(path: string, body?: unknown, options?: RequestOptions<T>): Promise<T>
  delete<T = unknown>(path: string, options?: RequestOptions<T>): Promise<T>
  /** Install or replace auth hooks (Phase 2 auth wiring). */
  setAuthHooks(hooks: AuthHooks): void
}

export const DEFAULT_TIMEOUT_MS = 20_000

export function buildUrl(baseUrl: string, path: string, query?: QueryParams): string {
  if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith('//')) {
    throw new Error(`API paths must be relative to the base URL, got "${path}"`)
  }
  const base = baseUrl.replace(/\/+$/, '')
  const cleanPath = path.replace(/^\/+/, '')
  const url = new URL(`${base}/${cleanPath}`)
  if (query) {
    for (const [key, raw] of Object.entries(query)) {
      const values: readonly QueryValue[] = Array.isArray(raw) ? raw : [raw as QueryValue]
      for (const value of values) {
        if (value === undefined || value === null || value === '') continue
        url.searchParams.append(key, String(value))
      }
    }
  }
  return url.toString()
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) return undefined
  const text = await response.text()
  if (!text) return undefined
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('json')) return text
  return JSON.parse(text) as unknown
}

export function createHttpClient(config: HttpClientConfig): HttpClient {
  const fetchImpl = config.fetch ?? globalThis.fetch.bind(globalThis)
  const defaultTimeout = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  let auth: AuthHooks = config.auth ?? {}
  let refreshInFlight: Promise<boolean> | null = null

  function refreshOnce(): Promise<boolean> {
    const refresh = auth.refreshSession
    if (!refresh) return Promise.resolve(false)
    refreshInFlight ??= refresh()
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null
      })
    return refreshInFlight
  }

  async function send<T>(
    method: HttpMethod,
    path: string,
    options: RequestOptions<T>,
    isRetry: boolean,
  ): Promise<T> {
    const url = buildUrl(config.baseUrl, path, options.query)
    const useAuth = options.auth !== false
    const headers = new Headers({ Accept: 'application/json', ...options.headers })

    let body: BodyInit | undefined
    if (options.body instanceof FormData) {
      body = options.body
    } else if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json')
      body = JSON.stringify(options.body)
    }

    if (useAuth) {
      const token = auth.getAccessToken?.()
      if (token) headers.set('Authorization', `Bearer ${token}`)
    }

    const timeoutSignal = AbortSignal.timeout(options.timeoutMs ?? defaultTimeout)
    const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal

    let response: Response
    try {
      response = await fetchImpl(url, {
        method,
        headers,
        body,
        signal,
        credentials: config.credentials ?? 'same-origin',
      })
    } catch (error) {
      if (options.signal?.aborted) {
        throw new ApiError({
          status: 0,
          code: 'aborted',
          message: 'The request was cancelled.',
          cause: error,
        })
      }
      if (timeoutSignal.aborted) {
        throw new ApiError({
          status: 0,
          code: 'timeout',
          message: 'The server took too long to respond.',
          cause: error,
        })
      }
      throw new ApiError({
        status: 0,
        code: 'network_error',
        message: 'Cannot reach the server. Check your connection and try again.',
        cause: error,
      })
    }

    if (response.status === 401 && useAuth && !isRetry) {
      if (await refreshOnce()) return send(method, path, options, true)
      auth.onSessionExpired?.()
    } else if (response.status === 401 && useAuth && isRetry) {
      auth.onSessionExpired?.()
    }

    let parsed: unknown
    try {
      parsed = await readBody(response)
    } catch (error) {
      if (!response.ok) throw apiErrorFromResponse(response.status, undefined)
      throw new ApiError({
        status: response.status,
        code: 'invalid_response',
        message: 'The server sent a response that could not be read.',
        cause: error,
      })
    }

    if (!response.ok) throw apiErrorFromResponse(response.status, parsed)

    if (options.schema) {
      const result = options.schema.safeParse(parsed)
      if (!result.success) {
        throw new ApiError({
          status: response.status,
          code: 'invalid_response',
          message: 'The server sent data in an unexpected format.',
          details: result.error.issues,
        })
      }
      return result.data
    }
    return parsed as T
  }

  return {
    request: (method, path, options = {}) => send(method, path, options, false),
    get: (path, options = {}) => send('GET', path, options, false),
    post: (path, body, options = {}) => send('POST', path, { ...options, body }, false),
    put: (path, body, options = {}) => send('PUT', path, { ...options, body }, false),
    patch: (path, body, options = {}) => send('PATCH', path, { ...options, body }, false),
    delete: (path, options = {}) => send('DELETE', path, options, false),
    setAuthHooks(hooks) {
      auth = hooks
    },
  }
}
