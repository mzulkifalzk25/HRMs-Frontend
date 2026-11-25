// Normalized API error (P1-T10). Every failure from the HTTP client is an ApiError,
// so screens handle one shape regardless of whether the cause was the network, a timeout,
// or a Django REST Framework error response.

export type ApiErrorCode =
  | 'network_error'
  | 'timeout'
  | 'aborted'
  | 'invalid_response'
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation_error'
  | 'rate_limited'
  | 'server_error'
  | 'http_error'

/** Field name → messages, e.g. `{ email: ['Enter a valid email address.'] }`. */
export type FieldErrors = Record<string, string[]>

export class ApiError extends Error {
  /** HTTP status, or 0 when no response was received (network error, timeout, abort). */
  readonly status: number
  readonly code: ApiErrorCode | (string & {})
  readonly fieldErrors: FieldErrors
  /** Parsed response body, if any. Never shown to users directly. */
  readonly details: unknown

  constructor(init: {
    status: number
    code: ApiErrorCode | (string & {})
    message: string
    fieldErrors?: FieldErrors
    details?: unknown
    cause?: unknown
  }) {
    super(init.message, init.cause === undefined ? undefined : { cause: init.cause })
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.fieldErrors = init.fieldErrors ?? {}
    this.details = init.details
  }

  /** True when the caller cancelled the request (not an error to show the user). */
  get isAborted(): boolean {
    return this.code === 'aborted'
  }

  /** True for errors worth retrying automatically (network, timeout, 5xx, 429). */
  get isRetryable(): boolean {
    return (
      this.code === 'network_error' ||
      this.code === 'timeout' ||
      this.status === 429 ||
      this.status >= 500
    )
  }
}

const DEFAULT_MESSAGES: Record<number, { code: ApiErrorCode; message: string }> = {
  400: { code: 'bad_request', message: 'The request was not valid.' },
  401: { code: 'unauthorized', message: 'Your session has expired. Please sign in again.' },
  403: { code: 'forbidden', message: 'You do not have permission to do this.' },
  404: { code: 'not_found', message: 'The requested item was not found.' },
  409: {
    code: 'conflict',
    message: 'This item was changed by someone else. Reload and try again.',
  },
  422: { code: 'validation_error', message: 'Some fields are not valid.' },
  429: { code: 'rate_limited', message: 'Too many requests. Please wait and try again.' },
}

function statusDefaults(status: number): { code: ApiErrorCode; message: string } {
  const known = DEFAULT_MESSAGES[status]
  if (known) return known
  if (status >= 500) {
    return { code: 'server_error', message: 'The server had a problem. Please try again later.' }
  }
  return { code: 'http_error', message: `Request failed with status ${status}.` }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toMessages(value: unknown): string[] | null {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value
  return null
}

const RESERVED_KEYS = new Set(['detail', 'code', 'message', 'error', 'non_field_errors'])

/**
 * Build an ApiError from an HTTP error response body. Understands:
 * - DRF default: `{ "detail": "...", "code"?: "..." }`
 * - DRF serializer errors: `{ "field": ["msg"], "non_field_errors": ["msg"] }`
 * - Envelope (proposed in docs/API_INTEGRATION.md): `{ "error": { "code", "message", "fields" } }`
 */
export function apiErrorFromResponse(status: number, body: unknown): ApiError {
  const defaults = statusDefaults(status)
  let code: string = defaults.code
  let message = defaults.message
  const fieldErrors: FieldErrors = {}

  if (isRecord(body)) {
    const envelope = isRecord(body.error) ? body.error : null
    const source = envelope ?? body

    if (typeof source.code === 'string' && source.code) code = source.code
    if (typeof source.message === 'string' && source.message) message = source.message
    if (typeof source.detail === 'string' && source.detail) message = source.detail

    const nonField = toMessages(source.non_field_errors)
    if (nonField?.length) message = nonField.join(' ')

    const fieldSource = envelope && isRecord(envelope.fields) ? envelope.fields : body
    for (const [key, value] of Object.entries(fieldSource)) {
      if (!envelope && RESERVED_KEYS.has(key)) continue
      const messages = toMessages(value)
      if (messages?.length) fieldErrors[key] = messages
    }

    if (status === 400 && Object.keys(fieldErrors).length > 0 && code === 'bad_request') {
      code = 'validation_error'
      if (!nonField?.length && message === defaults.message) message = 'Some fields are not valid.'
    }
  }

  return new ApiError({ status, code, message, fieldErrors, details: body })
}

export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.'

/**
 * Message that is safe to show to users. ApiError messages are written for users;
 * any other error (a bug, a TypeError) gets a generic message so internals never leak.
 */
export function userMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : GENERIC_ERROR_MESSAGE
}
