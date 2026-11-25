// Senior PM dashboard (P2-T15): Associate PM and project-team overview, pending approvals, summaries.
import { CalendarCheck, CalendarClock, CalendarX } from 'lucide-react'
import { SectionCard } from '@/components/shared/section-card'
import { StatCard } from '@/components/shared/stat-card'
import type { DashboardService } from '../api/dashboard.service'
import { useSeniorPmDashboard } from '../api/use-dashboards'
import { LiveTeamAttendance } from '../components/live-team-attendance'
import { DashboardHeader } from '../components/dashboard-header'
import { ApprovalTaskList } from '../components/dashboard-lists'
import { DashboardQueryView } from '../components/dashboard-query-view'
import { ProjectTeamList } from '../components/dashboard-widgets'

export function SeniorPmDashboardPage({ service }: { service?: DashboardService }) {
  const query = useSeniorPmDashboard(service)
  return (
    <div className="space-y-6">
      <DashboardHeader description="Project teams, Associate PMs and approvals across your projects." />
      <DashboardQueryView query={query}>
        {(data) => (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Pending leave requests"
                value={data.leaveSummary.pending}
                icon={CalendarClock}
                tone="warning"
              />
              <StatCard
                label="Approved this month"
                value={data.leaveSummary.approvedThisMonth}
                icon={CalendarCheck}
                tone="success"
              />
              <StatCard
                label="On leave today"
                value={data.leaveSummary.onLeaveToday}
                icon={CalendarX}
                tone="info"
              />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard title="Project teams" description="Associate PMs and team attendance">
                <ProjectTeamList teams={data.projectTeams} />
              </SectionCard>
              <SectionCard title="Pending approvals" description="Including Associate PM leave">
                <ApprovalTaskList
                  tasks={data.pendingApprovals}
                  emptyText="No requests need your approval."
                />
              </SectionCard>
            </div>
            <SectionCard title="Team attendance" description="Today, across your project teams">
              <LiveTeamAttendance />
            </SectionCard>
          </div>
        )}
      </DashboardQueryView>
    </div>
  )
}
