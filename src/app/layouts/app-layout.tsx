// Application shell (P1-T14): sidebar, top bar, breadcrumbs, search, notifications,
// user menu, mock-mode badge and responsive mobile navigation.
import { Menu } from 'lucide-react'
import { useState } from 'react'
import { Outlet } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { services, type ServiceMode } from '@/services/registry'
import { AppBreadcrumbs } from './shell/app-breadcrumbs'
import { Brand } from './shell/brand'
import { GlobalSearch } from './shell/global-search'
import { MockModeBadge } from './shell/mock-mode-badge'
import { NotificationMenu } from './shell/notification-menu'
import { SidebarNav } from './shell/sidebar-nav'
import { UserMenu } from './shell/user-menu'

export function AppLayout({ serviceMode = services.mode }: { serviceMode?: ServiceMode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const closeMobileNav = () => setMobileNavOpen(false)

  return (
    <div className="min-h-svh bg-background">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-card px-3 py-2 text-sm font-medium shadow-md focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-4">
          <SidebarNav />
        </div>
      </aside>

      <div className="flex min-h-svh flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-6">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open navigation"
              >
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0">
              <SheetHeader className="border-b border-sidebar-border">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <SheetDescription className="sr-only">
                  Main navigation for FormbaxHR
                </SheetDescription>
                <Brand onNavigate={closeMobileNav} />
              </SheetHeader>
              <div className="overflow-y-auto px-2 py-2">
                <SidebarNav onNavigate={closeMobileNav} />
              </div>
            </SheetContent>
          </Sheet>

          <div className="hidden min-w-0 md:block">
            <AppBreadcrumbs />
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            <div className="hidden sm:block sm:w-64 lg:w-80">
              <GlobalSearch />
            </div>
            <MockModeBadge mode={serviceMode} />
            <NotificationMenu />
            <UserMenu />
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8"
        >
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
