// Team Lead dashboard (P2-T17): team attendance, leave review/comment tasks, team overview.
// A Team Lead reviews, comments and recommends; they are not automatically a final approver (D-065).
import { SectionCard } from '@/components/shared/section-card'
import type { DashboardService } from '../api/dashboard.service'
import { useTeamLeadDashboard } from '../api/use-dashboards'
import { LiveTeamAttendance } from '../components/live-team-attendance'
import { DashboardHeader } from '../components/dashboard-header'
import { ApprovalTaskList, TeamMemberList } from '../components/dashboard-lists'
import { DashboardQueryView } from '../components/dashboard-query-view'

export function TeamLeadDashboardPage({ service }: { service?: DashboardService }) {
  const query = useTeamLeadDashboard(service)
  return (
    <div className="space-y-6">
      <DashboardHeader description="Your team today and the leave requests you can comment on." />
      <DashboardQueryView query={query}>
        {(data) => (
          <div className="space-y-6">
            <SectionCard title="Team attendance" description="Today">
              <LiveTeamAttendance />
            </SectionCard>
            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard title="Leave reviews" description="Add a comment or recommendation">
                <ApprovalTaskList
                  tasks={data.reviewTasks}
                  emptyText="No leave requests are waiting for your review."
                />
              </SectionCard>
              <SectionCard title="Team overview" description={`${data.team.length} people`}>
                <TeamMemberList members={data.team} />
              </SectionCard>
            </div>
          </div>
        )}
      </DashboardQueryView>
    </div>
  )
}
