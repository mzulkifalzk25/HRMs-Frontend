// TanStack Query hooks for imports. Executing an import refreshes everything it can change.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { services } from '@/services/registry'
import type { ColumnMapping, ImportType } from '../lib/import-definitions'
import type { ImportService } from './import.service'

export const importKeys = {
  all: ['imports'] as const,
  list: ['imports', 'list'] as const,
  job: (id: string) => ['imports', 'job', id] as const,
  rows: (id: string) => ['imports', 'rows', id] as const,
}

const svc = (service?: ImportService) => service ?? services.imports

export function useImports(service?: ImportService) {
  return useQuery({
    queryKey: importKeys.list,
    queryFn: ({ signal }) => svc(service).list({ signal }),
  })
}

export function useImportJob(id: string, service?: ImportService) {
  return useQuery({
    queryKey: importKeys.job(id),
    queryFn: ({ signal }) => svc(service).get(id, { signal }),
  })
}

export function useImportRows(id: string, enabled: boolean, service?: ImportService) {
  return useQuery({
    queryKey: importKeys.rows(id),
    queryFn: ({ signal }) => svc(service).rows(id, { signal }),
    enabled,
  })
}

export function useCreateImport(service?: ImportService) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ type, file }: { type: ImportType; file: File }) =>
      svc(service).create(type, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: importKeys.all }),
  })
}

export function useDryRun(service?: ImportService) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      mapping,
      updateExisting,
    }: {
      id: string
      mapping: ColumnMapping
      updateExisting: boolean
    }) => svc(service).dryRun(id, { mapping, updateExisting }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: importKeys.all }),
  })
}

/** Never retried automatically; the server rejects a second execution (409). */
export function useExecuteImport(service?: ImportService) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => svc(service).execute(id),
    // Imports change employees, attendance, leave and balances: refresh all data.
    onSettled: () => queryClient.invalidateQueries(),
  })
}
