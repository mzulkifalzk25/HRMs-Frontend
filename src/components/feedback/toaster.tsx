// Success/error feedback toasts (sonner), styled with the design tokens. Light theme only (D-072).
// Use `toast.success(...)` / `toast.error(...)` from 'sonner' in features.
import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster
      theme="light"
      position="top-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: 'border border-border bg-popover text-popover-foreground shadow-md',
          description: 'text-muted-foreground',
          success: '[&_[data-icon]]:text-success',
          error: '[&_[data-icon]]:text-destructive',
          warning: '[&_[data-icon]]:text-warning-foreground',
          info: '[&_[data-icon]]:text-info',
        },
      }}
    />
  )
}
