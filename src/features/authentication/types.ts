// Authentication domain types (P2-T01).

/** The six business roles (D-040). The Django superuser/technical admin is not a frontend role (D-041). */
export const ROLES = [
  'hr_admin',
  'manager',
  'senior_pm',
  'associate_pm',
  'team_lead',
  'employee',
] as const

export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  hr_admin: 'HR Administrator',
  manager: 'Manager',
  senior_pm: 'Senior Project Manager',
  associate_pm: 'Associate Project Manager',
  team_lead: 'Team Lead',
  employee: 'Employee',
}

export type User = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: Role
  employeeCode: string | null
  designation: string | null
  department: string | null
}

/** Active session. The access token lives only in memory (D-079). */
export type AuthSession = {
  user: User
  accessToken: string
}

export type LoginCredentials = { email: string; password: string }

/** Outcome of checking a password-reset or invitation token from an emailed link. */
export type TokenCheck =
  | { status: 'valid'; email?: string }
  | { status: 'invalid' }
  | { status: 'expired' }
  | { status: 'used' }

export function fullName(user: Pick<User, 'firstName' | 'lastName'>): string {
  return `${user.firstName} ${user.lastName}`.trim()
}

export function initials(user: Pick<User, 'firstName' | 'lastName'>): string {
  return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
}
