// Password policy for set/reset password forms (P2-T04…T06).
//
// PROVISIONAL until Q-AUTH-01 (password policy) is answered. Mirrors Django's default
// AUTH_PASSWORD_VALIDATORS that a Django backend uses unless configured otherwise:
// minimum length 8, not entirely numeric, not a common password, not too similar to the user.
// The frontend checks only what it can know locally (length, all-numeric) for instant feedback;
// common-password and similarity checks are done by the backend, which is authoritative.

export const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 128,
} as const

export type PasswordRule = {
  id: 'min-length' | 'not-numeric'
  label: string
  test: (password: string) => boolean
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: 'min-length',
    label: `At least ${PASSWORD_POLICY.minLength} characters`,
    test: (password) => password.length >= PASSWORD_POLICY.minLength,
  },
  {
    id: 'not-numeric',
    label: 'Not only numbers',
    test: (password) => password.length > 0 && !/^\d+$/.test(password),
  },
]

export function failedPasswordRules(password: string): PasswordRule[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(password))
}
