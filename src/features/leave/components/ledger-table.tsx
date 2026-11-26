// Leave ledger (P5-T03): every balance change, newest first, with actor, reason and request.
import { Link } from 'react-router'
import { EmptyState } from '@/components/feedback/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatAppDateTime } from '@/lib/datetime'
import { LEAVE_TYPE_LABELS } from '@/types/hr'
import { LEDGER_KIND_LABELS, type LedgerEntry } from '../schemas/leave.schema'

/** Signed effect on the remaining balance. */
function effect(e: LedgerEntry): number {
  return e.kind === 'deduction' ? -e.days : e.days
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n))

export function LedgerTable({ entries, caption }: { entries: LedgerEntry[]; caption: string }) {
  if (entries.length === 0) {
    return <EmptyState title="No ledger entries" description="Nothing has changed this year." />
  }
  const link = (e: LedgerEntry) =>
    e.requestId ? (
      <Link
        to={`/leave/requests/${e.requestId}`}
        className="text-primary underline-offset-4 hover:underline"
      >
        View request
      </Link>
    ) : null
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Change</TableHead>
              <TableHead className="text-right">Days</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap">{formatAppDateTime(e.at)}</TableCell>
                <TableCell>{LEAVE_TYPE_LABELS[e.leaveType]}</TableCell>
                <TableCell>{LEDGER_KIND_LABELS[e.kind]}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {signed(effect(e))}
                </TableCell>
                <TableCell>
                  <span>{e.reason}</span> {link(e)}
                </TableCell>
                <TableCell>{e.actorName}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y md:hidden" aria-label={caption}>
        {entries.map((e) => (
          <li key={e.id} className="space-y-1 py-3">
            <p className="flex justify-between gap-2 text-sm font-medium">
              <span>
                {LEAVE_TYPE_LABELS[e.leaveType]} · {LEDGER_KIND_LABELS[e.kind]}
              </span>
              <span className="tabular-nums">{signed(effect(e))}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {formatAppDateTime(e.at)} · {e.actorName} · {e.reason} {link(e)}
            </p>
          </li>
        ))}
      </ul>
    </>
  )
}
