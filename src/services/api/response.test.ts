// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { camelizeKeys, parseApiResponse } from './response'

describe('camelizeKeys', () => {
  it('converts nested object keys and leaves values alone', () => {
    expect(
      camelizeKeys({
        first_name: 'snake_value_kept',
        team_attendance: { not_checked_in: 2 },
        review_tasks: [{ requested_days: 1, employee_name: 'A' }],
        already: 1,
      }),
    ).toEqual({
      firstName: 'snake_value_kept',
      teamAttendance: { notCheckedIn: 2 },
      reviewTasks: [{ requestedDays: 1, employeeName: 'A' }],
      already: 1,
    })
  })

  it('handles primitives and null', () => {
    expect(camelizeKeys(null)).toBeNull()
    expect(camelizeKeys('a_b')).toBe('a_b')
    expect(camelizeKeys([1, 'x'])).toEqual([1, 'x'])
  })
})

describe('parseApiResponse', () => {
  const schema = z.object({ checkedAt: z.string() })

  it('returns the validated, camelized body', () => {
    expect(parseApiResponse(schema, { checked_at: 'x' })).toEqual({ checkedAt: 'x' })
  })

  it('turns contract violations into invalid_response errors', () => {
    expect(() => parseApiResponse(schema, { checked: 'x' })).toThrow(
      expect.objectContaining({ code: 'invalid_response' }),
    )
  })
})
