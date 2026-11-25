// Employee directory (P3-T03, P3-T14). Server-side search, filters, sorting and pagination with
// all state in the URL. Non-HR roles see only their authorized scope (the backend decides, D-044).
import { Plus, SearchX, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { EmptyState } from '@/components/feedback/empty-state'
import { ErrorState } from '@/components/feedback/error-state'
import { ListSkeleton } from '@/components/feedback/loading-skeletons'
import { NativeSelect } from '@/components/forms/native-select'
import { PageHeader } from '@/components/shared/page-header'
import { PaginationBar } from '@/components/tables/pagination-bar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ROLE_LABELS, ROLES, useCurrentUser } from '@/features/authentication'
import { useDepartments, useReportingLines, useTeams } from '@/features/organization'
import { userMessage } from '@/services/api'
import { useEmployeeList } from '../api/use-employees'
import { EmployeeTable } from '../components/employee-table'
import {
  hasActiveFilters,
  parseDirectoryParams,
  serializeDirectoryParams,
} from '../lib/directory-params'
import {
  EMPLOYEE_STATUS_LABELS,
  EMPLOYEE_STATUSES,
  PAGE_SIZES,
  type EmployeeListQuery,
} from '../schemas/employee.schema'

export function EmployeeDirectoryPage() {
  const user = useCurrentUser()
  const isHr = user.role === 'hr_admin'
  const [params, setParams] = useSearchParams()
  const query = parseDirectoryParams(params)
  const list = useEmployeeList(query)
  const departments = useDepartments()
  const teams = useTeams()
  const people = useReportingLines()
  const ids = {
    search: useId(),
    department: useId(),
    team: useId(),
    role: useId(),
    status: useId(),
    manager: useId(),
  }

  // Debounced search box: the URL (and therefore the request) updates 300 ms after typing stops.
  const [searchText, setSearchText] = useState(query.search ?? '')
  useEffect(() => {
    const trimmed = searchText.trim()
    if (trimmed === (params.get('q') ?? '')) return
    const timer = setTimeout(() => {
      setParams(
        (previous) =>
          serializeDirectoryParams({
            ...parseDirectoryParams(previous),
            search: trimmed || undefined,
            page: 1,
          }),
        { replace: true },
      )
    }, 300)
    return () => clearTimeout(timer)
  }, [searchText, params, setParams])

  function update(changes: Partial<EmployeeListQuery>, resetPage = true) {
    const next = { ...query, ...changes, ...(resetPage && !('page' in changes) ? { page: 1 } : {}) }
    setParams(serializeDirectoryParams(next), { replace: true })
  }

  function clearFilters() {
    setSearchText('')
    setParams(
      serializeDirectoryParams({ page: 1, pageSize: query.pageSize, ordering: query.ordering }),
      { replace: true },
    )
  }

  const managerIds = new Set((people.data ?? []).flatMap((person) => person.managerIds))
  const managerOptions = (people.data ?? [])
    .filter((person) => managerIds.has(person.id))
    .map((person) => ({ value: person.id, label: person.name }))
    .sort((a, b) => a.label.localeCompare(b.label))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description={isHr ? 'Everyone in the organization.' : 'People in your reporting scope.'}
        actions={
          isHr ? (
            <Button asChild>
              <Link to="/employees/new">
                <Plus aria-hidden="true" />
                Add employee
              </Link>
            </Button>
          ) : null
        }
      />

      <section
        aria-label="Search and filters"
        className="grid gap-3 rounded-lg border bg-card p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-6"
      >
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={ids.search}>Search employees</Label>
          <Input
            id={ids.search}
            type="search"
            placeholder="Name, email or employee ID"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.department}>Department</Label>
          <NativeSelect
            id={ids.department}
            placeholder="All departments"
            value={query.departmentId ?? ''}
            options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
            onChange={(event) => update({ departmentId: event.target.value || undefined })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.team}>Team</Label>
          <NativeSelect
            id={ids.team}
            placeholder="All teams"
            value={query.teamId ?? ''}
            options={(teams.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
            onChange={(event) => update({ teamId: event.target.value || undefined })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.role}>Role</Label>
          <NativeSelect
            id={ids.role}
            placeholder="All roles"
            value={query.role ?? ''}
            options={ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
            onChange={(event) =>
              update({ role: (event.target.value || undefined) as EmployeeListQuery['role'] })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.status}>Status</Label>
          <NativeSelect
            id={ids.status}
            placeholder="All statuses"
            value={query.status ?? ''}
            options={EMPLOYEE_STATUSES.map((status) => ({
              value: status,
              label: EMPLOYEE_STATUS_LABELS[status],
            }))}
            onChange={(event) =>
              update({ status: (event.target.value || undefined) as EmployeeListQuery['status'] })
            }
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
          <Label htmlFor={ids.manager}>Reports directly to</Label>
          <NativeSelect
            id={ids.manager}
            placeholder="Any manager"
            value={query.managerId ?? ''}
            options={managerOptions}
            onChange={(event) => update({ managerId: event.target.value || undefined })}
          />
        </div>
        {hasActiveFilters(query) ? (
          <div className="flex items-end lg:col-span-4 lg:justify-end">
            <Button variant="ghost" onClick={clearFilters}>
              <X aria-hidden="true" />
              Clear filters
            </Button>
          </div>
        ) : null}
      </section>

      <section
        aria-label="Employee list"
        aria-busy={list.isPending || list.isFetching}
        className="rounded-lg border bg-card shadow-xs"
      >
        {list.isPending ? (
          <>
            <span className="sr-only">Loading employees…</span>
            <ListSkeleton rows={6} className="border-0" />
          </>
        ) : list.isError ? (
          <div className="p-4">
            <ErrorState
              title="Could not load employees"
              message={userMessage(list.error)}
              onRetry={() => void list.refetch()}
              isRetrying={list.isFetching}
            />
          </div>
        ) : list.data.results.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={SearchX}
              title={
                hasActiveFilters(query) ? 'No employees match these filters' : 'No employees yet'
              }
              description={
                hasActiveFilters(query)
                  ? 'Try a different search or clear the filters.'
                  : isHr
                    ? 'Add the first employee to get started.'
                    : 'Nobody is in your reporting scope yet.'
              }
              action={
                hasActiveFilters(query) ? (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : null
              }
            />
          </div>
        ) : (
          <>
            <EmployeeTable
              rows={list.data.results}
              ordering={query.ordering}
              onOrderingChange={(ordering) => update({ ordering }, false)}
            />
            <PaginationBar
              page={query.page}
              pageSize={query.pageSize}
              total={list.data.count}
              pageSizes={PAGE_SIZES}
              itemLabel="employees"
              onPageChange={(page) => update({ page }, false)}
              onPageSizeChange={(pageSize) => update({ pageSize })}
            />
          </>
        )}
      </section>
    </div>
  )
}
