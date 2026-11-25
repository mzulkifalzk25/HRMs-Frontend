// TanStack Query hooks for the emailed-link flows (P2-T05, P2-T06). They use the session's own
// AuthService (from context), so every auth screen talks to the same service instance.
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuth } from '../session/auth-context'

export function useRequestPasswordReset() {
  const auth = useAuth().service
  return useMutation({ mutationFn: (email: string) => auth.requestPasswordReset(email) })
}

export function useResetTokenCheck(token: string | null) {
  const auth = useAuth().service
  return useQuery({
    queryKey: ['auth', 'reset-token', token],
    queryFn: () => auth.checkResetToken(token ?? ''),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
  })
}

export function useResetPassword() {
  const auth = useAuth().service
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      auth.resetPassword(token, password),
  })
}

export function useInvitationCheck(token: string | null) {
  const auth = useAuth().service
  return useQuery({
    queryKey: ['auth', 'invitation', token],
    queryFn: () => auth.checkInvitation(token ?? ''),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
  })
}

export function useAcceptInvitation() {
  const auth = useAuth().service
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      auth.acceptInvitation(token, password),
  })
}
