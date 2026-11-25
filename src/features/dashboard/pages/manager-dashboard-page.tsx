// Manager dashboard (P2-T14): own reporting scope only (D-044); final approval authority (D-065).
import { SectionCard } from '@/components/shared/section-card'
import type { DashboardService } from '../api/dashboard.service'
import { useManagerDashboard } from '../api/use-dashboards'
import { LiveTeamAttendance } from '../components/live-team-attendance'
import { DashboardHeader } from '../components/dashboard-header'
import { ApprovalTaskList, LeaveRequestList, TeamMemberList } from '../components/dashboard-lists'
import { DashboardQueryView } from '../components/dashboard-query-view'

export function ManagerDashboardPage({ service }: { service?: DashboardService }) {
  const query = useManagerDashboard(service)
  return (
    <div className="space-y-6">
      <DashboardHeader description="Your team's attendance, leave and approvals." />
      <DashboardQueryView query={query}>
        {(data) => (
          <div className="space-y-6">
            <SectionCard title="Team attendance" description="Today">
              <LiveTeamAttendance />
            </SectionCard>
            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard
                title="Approval inbox"
                description="Leave requests waiting for your decision"
              >
                <ApprovalTaskList
                  tasks={data.approvalInbox}
                  emptyText="No leave requests need your approval."
                />
              </SectionCard>
              <SectionCard title="Team leave requests" description="Recent requests from your team">
                <LeaveRequestList
                  requests={data.teamLeaveRequests}
                  emptyText="Your team has not requested leave recently."
                />
              </SectionCard>
            </div>
            <SectionCard title="Team overview" description={`${data.team.length} people`}>
              <TeamMemberList members={data.team} />
            </SectionCard>
          </div>
        )}
      </DashboardQueryView>
    </div>
  )
}
