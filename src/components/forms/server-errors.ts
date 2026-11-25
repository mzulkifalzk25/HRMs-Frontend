// Map an API error's field errors onto React Hook Form fields; everything else becomes a form-level
// message. Returns the form-level message to show (user-safe text only).
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError, userMessage } from '@/services/api'

export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly string[],
): string {
  let mapped = false
  if (error instanceof ApiError) {
    for (const [field, messages] of Object.entries(error.fieldErrors)) {
      if (fields.includes(field) && messages[0]) {
        setError(field as Path<T>, { message: messages[0] })
        mapped = true
      }
    }
  }
  return mapped ? 'Please correct the highlighted fields.' : userMessage(error)
}
