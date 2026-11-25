// Mock OrganizationService backed by the shared in-memory HR store.
import { mockHrStore, type HrStore } from '@/services/mock/hr-store'
import { DEFAULT_MOCK_LATENCY_MS, simulateLatency } from '@/services/mock/latency'
import type { OrganizationService } from './organization.service'

export function createMockOrganizationService(
  options: { latencyMs?: number; store?: HrStore } = {},
): OrganizationService {
  const latency = options.latencyMs ?? DEFAULT_MOCK_LATENCY_MS
  const store = options.store ?? mockHrStore
  const run = async <T>(work: () => T, signal?: AbortSignal): Promise<T> => {
    await simulateLatency(latency, signal)
    return work()
  }
  return {
    listDepartments: ({ signal } = {}) => run(() => store.listDepartments(), signal),
    createDepartment: (input) => run(() => store.createDepartment(input)),
    updateDepartment: (id, input) => run(() => store.updateDepartment(id, input)),
    setDepartmentStatus: (id, status) => run(() => store.setDepartmentStatus(id, status)),

    listDesignations: ({ signal } = {}) => run(() => store.listDesignations(), signal),
    createDesignation: (input) => run(() => store.createDesignation(input)),
    updateDesignation: (id, input) => run(() => store.updateDesignation(id, input)),
    setDesignationStatus: (id, status) => run(() => store.setDesignationStatus(id, status)),

    listTeams: ({ signal } = {}) => run(() => store.listTeams(), signal),
    saveTeam: (id, input) => run(() => store.saveTeam(id, input)),
    setTeamStatus: (id, status) => run(() => store.setTeamStatus(id, status)),

    listProjects: ({ signal } = {}) => run(() => store.listProjects(), signal),
    saveProject: (id, input) => run(() => store.saveProject(id, input)),
    setProjectStatus: (id, status) => run(() => store.setProjectStatus(id, status)),

    listReportingLines: ({ signal } = {}) => run(() => store.reportingLines(), signal),
  }
}
