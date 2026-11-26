// Employee dashboard (P2-T18): own records only (D-044).
import { CalendarDays, Clock, UserCheck } from 'lucide-react'
import { Link } from 'react-router'
import { SectionCard } from '@/components/shared/section-card'
import { StatCard } from '@/components/shared/stat-card'
import type { DashboardService } from '../api/dashboard.service'
import { useEmployeeDashboard } from '../api/use-dashboards'
import { DashboardHeader } from '../components/dashboard-header'
import { ActivityList } from '../components/dashboard-lists'
import { LiveLeaveBalances, LiveMyLeave } from '../components/live-leave'
import { DashboardQueryView } from '../components/dashboard-query-view'
import { CheckInCard } from '@/features/attendance'
import { LiveNotifications } from '../components/live-notifications'

export function EmployeeDashboardPage({ service }: { service?: DashboardService }) {
  const query = useEmployeeDashboard(service)
  return (
    <div className="space-y-6">
      <DashboardHeader description="Your attendance, leave balances and recent activity." />
      <DashboardQueryView query={query}>
        {(data) => (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <SectionCard title="Today" description="Your attendance">
                <CheckInCard />
              </SectionCard>
              <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2 lg:grid-cols-3">
                <StatCard
                  label="Days present this month"
                  value={data.monthSummary.presentDays}
                  icon={UserCheck}
                  tone="success"
                />
                <StatCard
                  label="Late-In this month"
                  value={data.monthSummary.lateDays}
                  icon={Clock}
                  tone="warning"
                  hint="Tracking only"
                />
                <StatCard
                  label="Leave days this month"
                  value={data.monthSummary.leaveDays}
                  icon={CalendarDays}
                  tone="info"
                />
                <SectionCard
                  title="Leave balances"
                  description="This leave year"
                  className="sm:col-span-3"
                >
                  <LiveLeaveBalances />
                </SectionCard>
              </div>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard title="Recent leave requests">
                <LiveMyLeave />
              </SectionCard>
              <SectionCard
                title="Notifications"
                actions={
                  <Link to="/notifications" className="text-xs text-primary hover:underline">
                    View all
                  </Link>
                }
              >
                <LiveNotifications />
              </SectionCard>
            </div>
            <SectionCard title="My activity" description="Today">
              <ActivityList
                items={data.recentActivity}
                emptyText="Your check-ins and requests appear here."
              />
            </SectionCard>
          </div>
        )}
      </DashboardQueryView>
    </div>
  )
}
