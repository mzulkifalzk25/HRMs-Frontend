// Organization management (P3-T08…T11): departments, designations, teams, projects. HR only.
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { ErrorState } from '@/components/feedback/error-state'
import { ListSkeleton } from '@/components/feedback/loading-skeletons'
import { PageHeader } from '@/components/shared/page-header'
import { SectionCard } from '@/components/shared/section-card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { userMessage } from '@/services/api'
import {
  useDepartments,
  useDesignations,
  useProjects,
  useReportingLines,
  useTeams,
} from '../api/use-organization'
import {
  DepartmentDialog,
  DesignationDialog,
  ProjectDialog,
  TeamDialog,
} from '../components/org-forms'
import { OrgRecordList } from '../components/org-record-list'

type Editing = {
  tab: 'departments' | 'designations' | 'teams' | 'projects'
  id: string | null
} | null

export function OrganizationPage() {
  const departments = useDepartments()
  const designations = useDesignations()
  const teams = useTeams()
  const projects = useProjects()
  const people = useReportingLines()
  const [tab, setTab] = useState<NonNullable<Editing>['tab']>('departments')
  const [editing, setEditing] = useState<Editing>(null)

  const queries = [departments, designations, teams, projects, people]
  const failed = queries.find((q) => q.isError)
  const ready = departments.data && designations.data && teams.data && projects.data && people.data
  const nameOf = (id: string | null) =>
    id ? (people.data?.find((p) => p.id === id)?.name ?? 'Unknown') : null

  const nouns = {
    departments: 'department',
    designations: 'designation',
    teams: 'team',
    projects: 'project',
  } as const

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization"
        description="Departments, designations, teams and projects. Records are deactivated, never deleted."
        actions={
          <Button onClick={() => setEditing({ tab, id: null })}>
            <Plus aria-hidden="true" />
            Add {nouns[tab]}
          </Button>
        }
      />

      {failed ? (
        <ErrorState
          title="Could not load organization data"
          message={userMessage(failed.error)}
          onRetry={() => queries.forEach((q) => void q.refetch())}
        />
      ) : !ready ? (
        <div aria-busy="true">
          <span className="sr-only">Loading organization…</span>
          <ListSkeleton rows={5} />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
          <TabsList>
            <TabsTrigger value="departments">Departments</TabsTrigger>
            <TabsTrigger value="designations">Designations</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
          </TabsList>

          <TabsContent value="departments">
            <SectionCard title="Departments">
              <OrgRecordList
                entity="department"
                noun="department"
                canManage
                onEdit={(id) => setEditing({ tab: 'departments', id })}
                rows={departments.data.map((d) => ({
                  id: d.id,
                  title: d.name,
                  status: d.status,
                  details: `${d.code ? `${d.code} · ` : ''}${d.headcount} ${d.headcount === 1 ? 'person' : 'people'}`,
                  deactivateWarning:
                    d.headcount > 0
                      ? `${d.headcount} people are still in this department.`
                      : undefined,
                }))}
              />
            </SectionCard>
          </TabsContent>

          <TabsContent value="designations">
            <SectionCard title="Designations">
              <OrgRecordList
                entity="designation"
                noun="designation"
                canManage
                onEdit={(id) => setEditing({ tab: 'designations', id })}
                rows={designations.data.map((d) => ({
                  id: d.id,
                  title: d.title,
                  status: d.status,
                  details: `${d.headcount} ${d.headcount === 1 ? 'person' : 'people'}`,
                }))}
              />
            </SectionCard>
          </TabsContent>

          <TabsContent value="teams">
            <SectionCard title="Teams">
              <OrgRecordList
                entity="team"
                noun="team"
                canManage
                onEdit={(id) => setEditing({ tab: 'teams', id })}
                rows={teams.data.map((t) => ({
                  id: t.id,
                  title: t.name,
                  status: t.status,
                  details: [
                    departments.data.find((d) => d.id === t.departmentId)?.name,
                    `Lead: ${nameOf(t.teamLeadId) ?? 'none'}`,
                    `${t.memberIds.length} members`,
                  ]
                    .filter(Boolean)
                    .join(' · '),
                }))}
              />
            </SectionCard>
          </TabsContent>

          <TabsContent value="projects">
            <SectionCard title="Projects">
              <OrgRecordList
                entity="project"
                noun="project"
                canManage
                onEdit={(id) => setEditing({ tab: 'projects', id })}
                rows={projects.data.map((p) => ({
                  id: p.id,
                  title: `${p.name} (${p.code})`,
                  status: p.status,
                  details: [
                    `Senior PM: ${nameOf(p.seniorPmId) ?? 'not assigned'}`,
                    `Associate PM: ${nameOf(p.associatePmId) ?? 'not assigned'}`,
                    `Teams: ${p.teamIds.map((id) => teams.data.find((t) => t.id === id)?.name ?? id).join(', ') || 'none'}`,
                  ].join(' · '),
                }))}
              />
            </SectionCard>
          </TabsContent>
        </Tabs>
      )}

      {ready ? (
        <>
          <DepartmentDialog
            open={editing?.tab === 'departments'}
            onOpenChange={(open) => !open && setEditing(null)}
            record={departments.data.find((d) => d.id === editing?.id) ?? null}
          />
          <DesignationDialog
            open={editing?.tab === 'designations'}
            onOpenChange={(open) => !open && setEditing(null)}
            record={designations.data.find((d) => d.id === editing?.id) ?? null}
          />
          <TeamDialog
            open={editing?.tab === 'teams'}
            onOpenChange={(open) => !open && setEditing(null)}
            record={teams.data.find((t) => t.id === editing?.id) ?? null}
            departments={departments.data}
            people={people.data}
          />
          <ProjectDialog
            open={editing?.tab === 'projects'}
            onOpenChange={(open) => !open && setEditing(null)}
            record={projects.data.find((p) => p.id === editing?.id) ?? null}
            teams={teams.data}
            people={people.data}
          />
        </>
      ) : null}
    </div>
  )
}
