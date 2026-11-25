// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/services/api'
import { createQueryClient, MAX_QUERY_RETRIES, shouldRetryQuery } from './query-client'

const apiError = (status: number, code: string) => new ApiError({ status, code, message: 'x' })

describe('shouldRetryQuery', () => {
  it.each([
    ['network error', apiError(0, 'network_error')],
    ['timeout', apiError(0, 'timeout')],
    ['429', apiError(429, 'rate_limited')],
    ['500', apiError(500, 'server_error')],
    ['503', apiError(503, 'server_error')],
  ])('retries %s', (_label, error) => {
    expect(shouldRetryQuery(0, error)).toBe(true)
  })

  it.each([
    ['400 validation', apiError(400, 'validation_error')],
    ['401', apiError(401, 'unauthorized')],
    ['403', apiError(403, 'forbidden')],
    ['404', apiError(404, 'not_found')],
    ['409 conflict', apiError(409, 'conflict')],
    ['aborted', apiError(0, 'aborted')],
    ['invalid response', apiError(200, 'invalid_response')],
  ])('does not retry %s', (_label, error) => {
    expect(shouldRetryQuery(0, error)).toBe(false)
  })

  it('does not retry unknown (programming) errors', () => {
    expect(shouldRetryQuery(0, new TypeError('x is undefined'))).toBe(false)
  })

  it(`stops after ${MAX_QUERY_RETRIES} retries`, () => {
    const error = apiError(503, 'server_error')
    expect(shouldRetryQuery(MAX_QUERY_RETRIES - 1, error)).toBe(true)
    expect(shouldRetryQuery(MAX_QUERY_RETRIES, error)).toBe(false)
  })
})

describe('createQueryClient', () => {
  it('never retries mutations automatically', () => {
    expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(false)
  })
})
