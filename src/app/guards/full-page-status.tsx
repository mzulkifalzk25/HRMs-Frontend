import { LoaderCircle } from 'lucide-react'

/** Full-screen status while the session is being restored. */
export function FullPageStatus({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background"
    >
      <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-primary" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}
