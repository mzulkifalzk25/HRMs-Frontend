// 14-day attendance trend (Recharts). Colours come from the chart tokens; a visually hidden table
// gives screen-reader users the same data as the chart.
import { format } from 'date-fns'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { EmptyState } from '@/components/feedback/empty-state'
import { appWallClockToInstant, formatDateKey } from '@/lib/datetime'
import type { AttendanceTrendPoint } from '../schemas/dashboard.schema'

const shortDate = (dateKey: string) => format(appWallClockToInstant(dateKey, '12:00'), 'd MMM')

const SERIES = [
  { key: 'present', label: 'Present', color: 'var(--chart-1)' },
  { key: 'late', label: 'Late-In', color: 'var(--chart-3)' },
  { key: 'absent', label: 'Absent', color: 'var(--chart-4)' },
] as const

export function AttendanceTrendChart({ points }: { points: AttendanceTrendPoint[] }) {
  if (points.length === 0) {
    return (
      <EmptyState
        title="No attendance data yet"
        description="Daily totals appear here once people check in."
        className="py-8"
      />
    )
  }
  return (
    <figure className="space-y-2">
      <div aria-hidden="true" className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              labelFormatter={(value) => formatDateKey(String(value))}
              contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}
            />
            {SERIES.map((series) => (
              <Area
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.label}
                stroke={series.color}
                fill={series.color}
                fillOpacity={0.12}
                strokeWidth={2}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {SERIES.map((series) => (
          <span key={series.key} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ background: series.color }}
            />
            {series.label}
          </span>
        ))}
      </figcaption>
      <table className="sr-only">
        <caption>Daily attendance for the last {points.length} days</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            {SERIES.map((series) => (
              <th key={series.key} scope="col">
                {series.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}>
              <th scope="row">{formatDateKey(point.date)}</th>
              <td>{point.present}</td>
              <td>{point.late}</td>
              <td>{point.absent}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
