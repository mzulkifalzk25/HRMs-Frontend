import { Database } from 'lucide-react'
import type { ReactNode } from 'react'

/** Clearly labelled mock-mode helper box (D-026): never shown in HTTP mode. */
export function MockHint({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside
      aria-label={title}
      className="space-y-2 rounded-lg border border-warning/60 bg-warning-subtle p-4 text-sm text-warning-subtle-foreground"
    >
      <p className="flex items-center gap-2 font-semibold">
        <Database aria-hidden="true" className="size-4" />
        {title}
      </p>
      <div className="space-y-2">{children}</div>
    </aside>
  )
}
