// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { failedPasswordRules, PASSWORD_POLICY } from '../lib/password-policy'
import {
  apiSessionSchema,
  apiTokenCheckSchema,
  apiUserSchema,
  forgotPasswordSchema,
  loginSchema,
  setPasswordSchema,
} from './auth.schema'

const messages = (result: { success: boolean; error?: { issues: Array<{ message: string }> } }) =>
  result.error?.issues.map((issue) => issue.message) ?? []

describe('loginSchema', () => {
  it('accepts and normalizes a valid login', () => {
    expect(loginSchema.parse({ email: '  Manager@FormbaxHR.test ', password: 'x' })).toEqual({
      email: 'manager@formbaxhr.test',
      password: 'x',
    })
  })

  it.each([
    [{ email: '', password: 'x' }, 'Enter your email address.'],
    [{ email: 'not-an-email', password: 'x' }, 'Enter a valid email address.'],
    [{ email: 'a@b.test', password: '' }, 'Enter your password.'],
  ])('rejects %j', (input, message) => {
    expect(messages(loginSchema.safeParse(input))).toContain(message)
  })

  it('does not apply the password policy when signing in', () => {
    expect(loginSchema.safeParse({ email: 'a@b.test', password: '1' }).success).toBe(true)
  })
})

describe('forgotPasswordSchema', () => {
  it('requires a valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'x' }).success).toBe(false)
    expect(forgotPasswordSchema.safeParse({ email: 'x@y.test' }).success).toBe(true)
  })
})

describe('password policy (provisional, Q-AUTH-01)', () => {
  it('requires the minimum length and not only numbers', () => {
    expect(PASSWORD_POLICY.minLength).toBe(8)
    expect(failedPasswordRules('short').map((rule) => rule.id)).toEqual(['min-length'])
    expect(failedPasswordRules('12345678').map((rule) => rule.id)).toEqual(['not-numeric'])
    expect(failedPasswordRules('')).toHaveLength(2)
    expect(failedPasswordRules('long enough pass')).toEqual([])
  })
})

describe('setPasswordSchema', () => {
  it('accepts matching passwords that meet the policy', () => {
    expect(
      setPasswordSchema.safeParse({ password: 'Strong pass 1', confirmPassword: 'Strong pass 1' })
        .success,
    ).toBe(true)
  })

  it('reports every failed rule and a mismatch', () => {
    expect(
      messages(setPasswordSchema.safeParse({ password: '1234', confirmPassword: '1234' })),
    ).toEqual(['At least 8 characters.', 'Not only numbers.'])
    const mismatch = setPasswordSchema.safeParse({
      password: 'Strong pass 1',
      confirmPassword: 'Strong pass 2',
    })
    expect(messages(mismatch)).toEqual(['Passwords do not match.'])
    expect(mismatch.error?.issues[0]?.path).toEqual(['confirmPassword'])
  })

  it('rejects passwords over the maximum length', () => {
    const long = 'a'.repeat(PASSWORD_POLICY.maxLength + 1)
    expect(setPasswordSchema.safeParse({ password: long, confirmPassword: long }).success).toBe(
      false,
    )
  })
})

describe('API schemas', () => {
  it('maps a snake_case user to the User type', () => {
    expect(
      apiUserSchema.parse({
        id: 7,
        email: 'a@b.test',
        first_name: 'A',
        last_name: 'B',
        role: 'manager',
      }),
    ).toEqual({
      id: '7',
      email: 'a@b.test',
      firstName: 'A',
      lastName: 'B',
      role: 'manager',
      employeeCode: null,
      designation: null,
      department: null,
    })
  })

  it('rejects unknown roles, including a technical superuser role', () => {
    const user = { id: 1, email: 'a@b.test', first_name: 'A', last_name: 'B' }
    expect(apiUserSchema.safeParse({ ...user, role: 'superuser' }).success).toBe(false)
  })

  it('requires an access token in session responses and validates token checks', () => {
    const user = { id: 1, email: 'a@b.test', first_name: 'A', last_name: 'B', role: 'employee' }
    expect(apiSessionSchema.safeParse({ access: '', user }).success).toBe(false)
    expect(apiSessionSchema.safeParse({ access: 'jwt', user }).success).toBe(true)
    expect(apiTokenCheckSchema.safeParse({ status: 'valid', email: 'x@y.test' }).success).toBe(true)
    expect(apiTokenCheckSchema.safeParse({ status: 'maybe' }).success).toBe(false)
  })
})
