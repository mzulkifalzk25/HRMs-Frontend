// @vitest-environment node
// HTTP implementations against the proposed endpoints (docs/API_INTEGRATION.md §6).
import { describe, expect, it, vi } from 'vitest'
import { createHttpOrganizationService } from '@/features/organization/api/organization.http'
import { createHttpClient } from '@/services/api'
import { createHttpEmployeeService } from './employee.http'

const BASE = 'http://localhost:8000/api/v1'
const apiEmployee = {
  id: 'e-1',
  employee_code: 'FBX-1001',
  first_name: 'Hamza',
  last_name: 'Kareem',
  email: 'hamza.kareem@formbaxhr.test',
  phone: null,
  role: 'employee',
  department_id: 'd-eng',
  designation_id: 'g-se',
  joining_date: '2023-01-09',
  status: 'active',
  manager_ids: ['m-1'],
  team_ids: [],
  project_ids: [],
  deactivation_reason: null,
}

function setup(body: unknown) {
  const fetchMock = vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  )
  const client = createHttpClient({ baseUrl: BASE, fetch: fetchMock as typeof fetch })
  const call = () => ({
    url: String(fetchMock.mock.calls.at(-1)?.[0]),
    init: fetchMock.mock.calls.at(-1)?.[1] ?? {},
  })
  return { client, call }
}

describe('createHttpEmployeeService', () => {
  it('lists with DRF query parameters and parses the page', async () => {
    const { client, call } = setup({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          ...apiEmployee,
          department_name: 'Engineering',
          designation_title: 'Software Engineer',
          manager_names: ['Imran Demo'],
        },
      ],
    })
    const page = await createHttpEmployeeService(client).list({
      page: 2,
      pageSize: 25,
      search: 'ham',
      departmentId: 'd-eng',
      status: 'active',
      ordering: '-joining_date',
    })
    expect(call().url).toBe(
      `${BASE}/employees/?page=2&page_size=25&search=ham&department=d-eng&status=active&ordering=-joining_date`,
    )
    expect(page.results[0]).toMatchObject({ firstName: 'Hamza', managerNames: ['Imran Demo'] })
  })

  it('sends snake_case bodies and only the patch fields', async () => {
    const { client, call } = setup(apiEmployee)
    const service = createHttpEmployeeService(client)
    await service.update('e-1', { managerIds: ['m-1', 'm-2'], phone: null })
    expect(call().url).toBe(`${BASE}/employees/e-1/`)
    expect(call().init.method).toBe('PATCH')
    expect(JSON.parse(String(call().init.body))).toEqual({
      manager_ids: ['m-1', 'm-2'],
      phone: null,
    })
    await service.deactivate('e-1', 'Resigned')
    expect(call().url).toBe(`${BASE}/employees/e-1/deactivate/`)
    expect(JSON.parse(String(call().init.body))).toEqual({ reason: 'Resigned' })
  })

  it('rejects responses that break the contract', async () => {
    const { client } = setup({ ...apiEmployee, joining_date: '09/01/2023' })
    await expect(createHttpEmployeeService(client).get('e-1')).rejects.toMatchObject({
      code: 'invalid_response',
    })
  })
})

describe('createHttpOrganizationService', () => {
  it('uses one resource per record type and snake_case bodies', async () => {
    const { client, call } = setup({
      id: 't-1',
      name: 'Backend',
      department_id: 'd-eng',
      team_lead_id: null,
      member_ids: ['e-1'],
      status: 'active',
    })
    const service = createHttpOrganizationService(client)
    await service.saveTeam(null, {
      name: 'Backend',
      departmentId: 'd-eng',
      teamLeadId: null,
      memberIds: ['e-1'],
    })
    expect(call().url).toBe(`${BASE}/teams/`)
    expect(call().init.method).toBe('POST')
    expect(JSON.parse(String(call().init.body))).toEqual({
      name: 'Backend',
      department_id: 'd-eng',
      team_lead_id: null,
      member_ids: ['e-1'],
    })
    await service.setTeamStatus('t-1', 'inactive')
    expect(call().url).toBe(`${BASE}/teams/t-1/`)
    expect(call().init.method).toBe('PATCH')
    expect(JSON.parse(String(call().init.body))).toEqual({ status: 'inactive' })
  })

  it('reads reporting lines from the employees resource', async () => {
    const { client, call } = setup([
      {
        id: 'e-1',
        name: 'Hamza Kareem',
        designation: null,
        department_name: null,
        role: 'employee',
        status: 'active',
        manager_ids: [],
      },
    ])
    const lines = await createHttpOrganizationService(client).listReportingLines()
    expect(call().url).toBe(`${BASE}/employees/reporting-lines/`)
    expect(lines[0]).toMatchObject({ name: 'Hamza Kareem', managerIds: [] })
  })
})
