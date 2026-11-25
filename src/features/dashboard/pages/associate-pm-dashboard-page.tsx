// Associate PM dashboard (P2-T16): assigned team, attendance, review and recommendation tasks.
// An Associate PM participates in reviews but does not override the final decision (D-065).
import { SectionCard } from '@/components/shared/section-card'
import type { DashboardService } from '../api/dashboard.service'
import { useAssociatePmDashboard } from '../api/use-dashboards'
import { AttendanceSummary } from '../components/attendance-summary'
import { DashboardHeader } from '../components/dashboard-header'
import { ApprovalTaskList, TeamMemberList } from '../components/dashboard-lists'
import { DashboardQueryView } from '../components/dashboard-query-view'

export function AssociatePmDashboardPage({ service }: { service?: DashboardService }) {
  const query = useAssociatePmDashboard(service)
  return (
    <div className="space-y-6">
      <DashboardHeader description="Your assigned team and the requests you review." />
      <DashboardQueryView query={query}>
        {(data) => (
          <div className="space-y-6">
            <SectionCard title="Team attendance" description="Today">
              <AttendanceSummary summary={data.teamAttendance} />
            </SectionCard>
            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard
                title="Review and recommendation tasks"
                description="Your input before the final decision"
              >
                <ApprovalTaskList
                  tasks={data.reviewTasks}
                  emptyText="No requests are waiting for your recommendation."
                />
              </SectionCard>
              <SectionCard title="Assigned team" description={`${data.team.length} people`}>
                <TeamMemberList members={data.team} />
              </SectionCard>
            </div>
          </div>
        )}
      </DashboardQueryView>
    </div>
  )
}
