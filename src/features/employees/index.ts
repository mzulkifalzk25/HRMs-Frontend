// Public API of the employees feature (docs/ARCHITECTURE.md §2).
// Pages are lazy-loaded by the router directly (code splitting).
export { employeeKeys, useEmployee, useEmployeeList } from './api/use-employees'
export type { EmployeeService } from './api/employee.service'
export type { Employee, EmployeeListItem, EmployeeStatus } from './schemas/employee.schema'
export { EMPLOYEE_POLICY } from './lib/employee-policy'
