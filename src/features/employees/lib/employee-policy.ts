// Organization and employee rules that are NOT yet confirmed (Q-ORG-01…05). Every provisional
// choice lives here, so answering a question means changing one value (D-084).
// The backend remains authoritative for all of them.

export const EMPLOYEE_POLICY = {
  /**
   * Q-ORG-01: employee ID format. Provisional: the backend assigns the employee code
   * (shown as e.g. FBX-1006); HR does not type it. No national ID (CNIC) or other
   * sensitive identifiers are collected until the personal-data scope is decided.
   */
  employeeCodeAssignedByBackend: true,

  /** Q-ORG-02: single company (no tenant switcher). */
  multiCompany: false,

  /**
   * Q-ORG-03: deactivation reason. Provisional: required, because the change is audited
   * (D-058/D-070 audit module). Effects on pending leave and approvals are decided later.
   */
  deactivationReasonRequired: true,
  deactivationReasonMinLength: 5,

  /** Q-ORG-04: one department per employee; several teams and projects allowed. */
  multipleDepartments: false,
  multipleTeams: true,
  multipleProjects: true,

  /**
   * Q-ORG-05: HR editing their own record. Provisional: HR may edit their own contact
   * details but not their own role or account status (prevents self-escalation/lock-out).
   */
  hrCanChangeOwnRoleOrStatus: false,
} as const
