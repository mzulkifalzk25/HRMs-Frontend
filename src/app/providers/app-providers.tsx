import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Toaster } from '@/components/feedback/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { createQueryClient } from './query-client'

type AppProvidersProps = {
  children: ReactNode
  /** Injected in tests; the app creates its own. */
  queryClient?: QueryClient
}

export function AppProviders({ children, queryClient }: AppProvidersProps) {
  const [client] = useState(() => queryClient ?? createQueryClient())
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider delayDuration={300}>
        {children}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
