// Persistent "Mock data" indicator (P1-T16, D-026): mock operations must never look like
// real backend operations. Rendered whenever the service registry runs in mock mode.
// A real <button> is the tooltip trigger, so keyboard and screen-reader users get the
// explanation too (focus shows the tooltip; the description is also in the accessible name).
import { Database } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ServiceMode } from '@/services/registry'

export const MOCK_MODE_DESCRIPTION =
  'FormbaxHR is running on fictional mock data. Nothing is saved to a real server.'

export function MockModeBadge({ mode }: { mode: ServiceMode }) {
  if (mode !== 'mock') return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Mock data. ${MOCK_MODE_DESCRIPTION}`}
          className="inline-flex shrink-0 cursor-help items-center gap-1.5 rounded-md border border-warning/60 bg-warning-subtle px-2 py-1 text-xs font-semibold text-warning-subtle-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Database aria-hidden="true" className="size-3.5" />
          Mock data
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-64">
        {MOCK_MODE_DESCRIPTION}
      </TooltipContent>
    </Tooltip>
  )
}
