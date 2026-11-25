// Who is "signed in" to the mock backend. A real API knows the caller from the access token;
// mock services read this instead so they can scope data and refuse forbidden actions.
// Set by the mock AuthService on login/restore/refresh and cleared on logout.
import type { Role } from '@/features/authentication/types'

export type MockViewer = { id: string; role: Role }

let viewer: MockViewer | null = null

export function setMockViewer(next: MockViewer | null): void {
  viewer = next
}

export function getMockViewer(): MockViewer | null {
  return viewer
}
