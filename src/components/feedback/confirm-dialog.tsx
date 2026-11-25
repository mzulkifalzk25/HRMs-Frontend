import { useId, useState, type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Destructive actions (deactivate, decline) use the destructive button style. */
  destructive?: boolean
  /**
   * Ask for a written reason (e.g. attendance corrections, leave rejections). The confirm
   * button stays disabled until a non-blank reason is entered; it is passed to `onConfirm`.
   */
  reason?: { label: string; placeholder?: string; minLength?: number }
  isPending?: boolean
  onConfirm: (reason?: string) => void
}

/** Confirmation for destructive or important actions (D-072). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  reason,
  isPending = false,
  onConfirm,
}: ConfirmDialogProps) {
  const reasonId = useId()
  const [reasonText, setReasonText] = useState('')
  const trimmed = reasonText.trim()
  const reasonValid = !reason || trimmed.length >= Math.max(1, reason.minLength ?? 1)

  function handleOpenChange(next: boolean) {
    if (!next) setReasonText('')
    onOpenChange(next)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {reason ? (
          <div className="space-y-1.5">
            <label htmlFor={reasonId} className="text-sm font-medium">
              {reason.label} <span className="text-destructive">*</span>
            </label>
            <textarea
              id={reasonId}
              value={reasonText}
              onChange={(event) => setReasonText(event.target.value)}
              placeholder={reason.placeholder}
              required
              aria-required="true"
              rows={3}
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'default'}
            disabled={!reasonValid || isPending}
            onClick={(event) => {
              event.preventDefault()
              if (!reasonValid) return
              onConfirm(reason ? trimmed : undefined)
            }}
          >
            {isPending ? 'Working…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
