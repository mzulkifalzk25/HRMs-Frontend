// HR allocation adjustment (P5-T15, D-062): add or remove days for one category with a reason.
// Each adjustment is a ledger entry. Leave-year rules (proration, carry-forward) are not built
// (provisional D-090).
import { useId, useState } from 'react'
import { toast } from 'sonner'
import { NativeSelect } from '@/components/forms/native-select'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ApiError, userMessage } from '@/services/api'
import { LEAVE_TYPE_LABELS, LEAVE_TYPES, type LeaveType } from '@/types/hr'
import { useAdjustAllocation } from '../api/use-leave'
import { LEAVE_POLICY } from '../lib/leave-policy'

export function AdjustAllocationDialog({
  employee,
  year,
  open,
  onOpenChange,
}: {
  employee: { id: string; name: string }
  year: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <AdjustForm employee={employee} year={year} onClose={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function AdjustForm({
  employee,
  year,
  onClose,
}: {
  employee: { id: string; name: string }
  year: number
  onClose: () => void
}) {
  const adjust = useAdjustAllocation()
  const ids = { type: useId(), days: useId(), reason: useId() }
  const [leaveType, setLeaveType] = useState<LeaveType>('annual')
  const [daysText, setDaysText] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const value = Number(daysText)
    const next: Record<string, string> = {}
    if (!Number.isInteger(value) || value === 0)
      next.days = 'Enter a whole number of days other than 0 (negative removes days).'
    if (reason.trim().length < LEAVE_POLICY.reasonMinLength)
      next.reason = `Give a reason (at least ${LEAVE_POLICY.reasonMinLength} characters).`
    setErrors(next)
    if (Object.keys(next).length > 0) return
    try {
      await adjust.mutateAsync({
        employeeId: employee.id,
        leaveType,
        year,
        days: value,
        reason: reason.trim(),
      })
      toast.success('Allocation changed. The change is recorded in the ledger.')
      onClose()
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) {
        setErrors({
          days: error.fieldErrors.days?.[0] ?? '',
          reason: error.fieldErrors.reason?.[0] ?? '',
        })
      } else {
        setErrors({ root: userMessage(error) })
      }
    }
  }

  const fieldError = (key: string) =>
    errors[key] ? (
      <p id={`${key}-error`} className="text-sm text-destructive">
        {errors[key]}
      </p>
    ) : null

  return (
    <form noValidate onSubmit={(e) => void submit(e)} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Adjust allocation</DialogTitle>
        <DialogDescription>
          {employee.name}, leave year {year}. The reason is kept in the ledger.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor={ids.type}>Leave type</Label>
        <NativeSelect
          id={ids.type}
          value={leaveType}
          options={LEAVE_TYPES.map((t) => ({ value: t, label: LEAVE_TYPE_LABELS[t] }))}
          onChange={(e) => setLeaveType(e.target.value as LeaveType)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={ids.days}>Days to add (use a minus sign to remove)</Label>
        <Input
          id={ids.days}
          inputMode="numeric"
          value={daysText}
          onChange={(e) => setDaysText(e.target.value)}
          aria-invalid={Boolean(errors.days)}
          aria-describedby={errors.days ? 'days-error' : undefined}
        />
        {fieldError('days')}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={ids.reason}>Reason (required)</Label>
        <Textarea
          id={ids.reason}
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={Boolean(errors.reason)}
          aria-describedby={errors.reason ? 'reason-error' : undefined}
        />
        {fieldError('reason')}
      </div>
      {errors.root ? (
        <p role="alert" className="text-sm text-destructive">
          {errors.root}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={adjust.isPending}>
          {adjust.isPending ? 'Saving…' : 'Save adjustment'}
        </Button>
      </DialogFooter>
    </form>
  )
}
