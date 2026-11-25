// Zod schemas for authentication forms and API responses (P2-T01).
import { z } from 'zod'
import { PASSWORD_POLICY, PASSWORD_RULES } from '../lib/password-policy'
import { ROLES } from '../types'

const email = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .pipe(z.email('Enter a valid email address.'))
  .transform((value) => value.toLowerCase())

export const loginSchema = z.object({
  email,
  // Login only checks presence: the policy applies when passwords are set, not when typed.
  password: z.string().min(1, 'Enter your password.'),
})
export type LoginFormValues = z.input<typeof loginSchema>

export const forgotPasswordSchema = z.object({ email })
export type ForgotPasswordFormValues = z.input<typeof forgotPasswordSchema>

const newPassword = z
  .string()
  .max(PASSWORD_POLICY.maxLength, `Use at most ${PASSWORD_POLICY.maxLength} characters.`)
  .superRefine((value, ctx) => {
    for (const rule of PASSWORD_RULES) {
      if (!rule.test(value)) ctx.addIssue({ code: 'custom', message: `${rule.label}.` })
    }
  })

/** Used by both "reset password" and "set password from invitation". */
export const setPasswordSchema = z
  .object({
    password: newPassword,
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  })
export type SetPasswordFormValues = z.input<typeof setPasswordSchema>

/** User as returned by the API (snake_case), mapped to the camelCase `User` type. */
export const apiUserSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    email: z.email(),
    first_name: z.string(),
    last_name: z.string(),
    role: z.enum(ROLES),
    employee_code: z.string().nullable().default(null),
    designation: z.string().nullable().default(null),
    department: z.string().nullable().default(null),
  })
  .transform((user) => ({
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
    employeeCode: user.employee_code,
    designation: user.designation,
    department: user.department,
  }))

/** Login and refresh responses: access token in the body; refresh token arrives as an httpOnly cookie. */
export const apiSessionSchema = z.object({ access: z.string().min(1), user: apiUserSchema })

export const apiTokenCheckSchema = z.object({
  status: z.enum(['valid', 'invalid', 'expired', 'used']),
  email: z.email().optional(),
})
