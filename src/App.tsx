import { CalendarCheck, Clock, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Temporary placeholder. Replaced by the router and app shell in P1-T13 / P1-T14.
// Previews the design tokens, a shadcn/ui primitive and Lucide icons.
export default function App() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">FormbaxHR</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Project foundation scaffold (Phase 1). Design tokens and component preview.
        </p>

        <div className="mt-6 flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-md bg-primary px-2.5 py-1 text-primary-foreground">Primary</span>
          <span className="rounded-md bg-success-subtle px-2.5 py-1 text-success-subtle-foreground">
            Success
          </span>
          <span className="rounded-md bg-warning-subtle px-2.5 py-1 text-warning-subtle-foreground">
            Warning
          </span>
          <span className="rounded-md bg-destructive-subtle px-2.5 py-1 text-destructive-subtle-foreground">
            Destructive
          </span>
          <span className="rounded-md bg-info-subtle px-2.5 py-1 text-info-subtle-foreground">
            Info
          </span>
          <span className="rounded-md bg-muted px-2.5 py-1 text-muted-foreground">Neutral</span>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button>
            <Clock aria-hidden="true" />
            Check in
          </Button>
          <Button variant="outline">
            <CalendarCheck aria-hidden="true" />
            Apply leave
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Decline</Button>
          <Button variant="link">Link</Button>
          <Button size="icon" variant="outline" aria-label="Add employee">
            <Plus aria-hidden="true" />
          </Button>
        </div>
      </div>
    </main>
  )
}
