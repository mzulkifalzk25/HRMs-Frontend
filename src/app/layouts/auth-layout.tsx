// Layout for login, password and invitation pages.
import { Outlet } from 'react-router'
import { services, type ServiceMode } from '@/services/registry'
import { Brand } from './shell/brand'
import { MockModeBadge } from './shell/mock-mode-badge'

export function AuthLayout({ serviceMode = services.mode }: { serviceMode?: ServiceMode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-14 items-center justify-between px-4 sm:px-6">
        <Brand />
        <MockModeBadge mode={serviceMode} />
      </header>
      <main
        id="main-content"
        className="flex flex-1 items-start justify-center px-4 pt-8 pb-16 sm:pt-16"
      >
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
