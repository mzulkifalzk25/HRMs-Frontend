// Settings hooks. Changes refresh settings, leave data (holidays and rules affect leave) and audit.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { services } from '@/services/registry'
import type { Settings } from '../schemas/settings.schema'
import type { SettingsService } from './settings.service'

export const settingsKey = ['settings'] as const

export function useSettings() {
  return useQuery({
    queryKey: settingsKey,
    queryFn: ({ signal }) => services.settings.get({ signal }),
  })
}

export function useSettingsMutation<A>(
  call: (svc: SettingsService, input: A) => Promise<Settings>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: A) => call(services.settings, input),
    onSuccess: (settings) => {
      queryClient.setQueryData(settingsKey, settings)
      void queryClient.invalidateQueries({ queryKey: ['leave'] })
      void queryClient.invalidateQueries({ queryKey: ['audit'] })
    },
  })
}
