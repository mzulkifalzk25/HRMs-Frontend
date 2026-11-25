// HR dashboard (P2-T13): organization-wide HR overview (D-044).
import { CalendarClock, Clock, UserCheck, UserX, Users } from 'lucide-react'
import { SectionCard } from '@/components/shared/section-card'
import { StatCard } from '@/components/shared/stat-card'
import type { DashboardService } from '../api/dashboard.service'
import { useHrDashboard } from '../api/use-dashboards'
import { AttendanceTrendChart } from '../components/attendance-trend-chart'
import { DashboardHeader } from '../components/dashboard-header'
import { ActivityList } from '../components/dashboard-lists'
import { DashboardQueryView } from '../components/dashboard-query-view'
import { DepartmentOverview } from '../components/dashboard-widgets'

export function HrDashboardPage({ service }: { service?: DashboardService }) {
  const query = useHrDashboard(service)
  return (
    <div className="space-y-6">
      <DashboardHeader description="Organization-wide attendance and leave at a glance." />
      <DashboardQueryView query={query}>
        {(data) => (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard label="Total employees" value={data.metrics.totalEmployees} icon={Users} />
              <StatCard
                label="Present today"
                value={data.metrics.presentToday}
                icon={UserCheck}
                tone="success"
              />
              <StatCard
                label="Absent today"
                value={data.metrics.absentToday}
                icon={UserX}
                tone="danger"
                hint="Provisional definition"
              />
              <StatCard
                label="Late arrivals"
                value={data.metrics.lateArrivals}
                icon={Clock}
                tone="warning"
                hint="Tracking only"
              />
              <StatCard
                label="Pending leave requests"
                value={data.metrics.pendingLeaveRequests}
                icon={CalendarClock}
                tone="info"
              />
            </div>
            <div className="grid gap-6 xl:grid-cols-3">
              <SectionCard
                title="Attendance trend"
                description="Last 14 days"
                className="xl:col-span-2"
              >
                <AttendanceTrendChart points={data.attendanceTrend} />
              </SectionCard>
              <SectionCard title="Department overview" description="Present today by department">
                <DepartmentOverview departments={data.departments} />
              </SectionCard>
            </div>
            <SectionCard title="Recent HR activity" description="Today">
              <ActivityList
                items={data.recentActivity}
                emptyText="Changes made by HR appear here."
              />
            </SectionCard>
          </div>
        )}
      </DashboardQueryView>
    </div>
  )
}
