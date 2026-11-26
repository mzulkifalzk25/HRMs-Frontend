// Leave policy values in one place (P5). Confirmed values cite D-060/D-088/D-089; provisional ones
// cite D-090 and the open question. Change a rule here, not in screens or the mock backend.

/** Weekdays counted as leave days, 0 = Sunday … 6 = Saturday: Monday–Friday (D-088, Q-LEAVE-04). */
export const LEAVE_WORKING_WEEKDAYS: readonly number[] = [1, 2, 3, 4, 5]

export const LEAVE_POLICY = {
  /** Whole days only; no half-day leave (D-088, Q-LEAVE-06). */
  halfDays: false,
  /** A request may never exceed the remaining days of its category (D-088, Q-LEAVE-07). */
  allowNegativeBalance: false,
  /** No overlap with the requester's own pending or approved requests (D-088, Q-LEAVE-09). */
  allowOverlap: false,
  /** Past dates are allowed and marked as backdated (D-088, Q-LEAVE-09). */
  allowBackdated: true,
  /** Requester may cancel approved leave until the day before it starts (D-088, Q-LEAVE-08). */
  cancelApprovedUntilDayBeforeStart: true,
  /** Minimum length of the application reason and of decline/override reasons (D-090). */
  reasonMinLength: 5,
  /** Leave year = calendar year, no proration, no carry-forward (provisional D-090, Q-LEAVE-01…03). */
  leaveYear: 'calendar' as const,
}

/** Attachments: optional for every type; PDF, JPG or PNG, at most 5 MB (D-088, Q-LEAVE-10). */
export const LEAVE_ATTACHMENT_RULES = {
  contentTypes: ['application/pdf', 'image/jpeg', 'image/png'] as readonly string[],
  extensions: ['.pdf', '.jpg', '.jpeg', '.png'] as readonly string[],
  maxBytes: 5 * 1024 * 1024,
  label: 'PDF, JPG or PNG, up to 5 MB',
}

/** The leave year a date belongs to (calendar year, provisional D-090). */
export function leaveYearOf(dateKey: string): number {
  return Number(dateKey.slice(0, 4))
}

export type AttachmentProblem = 'type' | 'size' | null

/** Checks a file against the attachment rules; the backend checks again (content sniffing). */
export function attachmentProblem(file: { name: string; size: number; type: string }) {
  const name = file.name.toLowerCase()
  const typeOk =
    LEAVE_ATTACHMENT_RULES.contentTypes.includes(file.type) &&
    LEAVE_ATTACHMENT_RULES.extensions.some((ext) => name.endsWith(ext))
  if (!typeOk) return 'type' satisfies AttachmentProblem
  if (file.size > LEAVE_ATTACHMENT_RULES.maxBytes) return 'size' satisfies AttachmentProblem
  return null
}

export const ATTACHMENT_MESSAGES: Record<'type' | 'size', string> = {
  type: 'Attach a PDF, JPG or PNG file.',
  size: 'The file is larger than 5 MB.',
}
