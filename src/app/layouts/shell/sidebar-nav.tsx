import { NavLink } from 'react-router'
import { NAV_SECTIONS } from '@/app/navigation'
import { cn } from '@/lib/utils'

/** Navigation list shared by the desktop sidebar and the mobile sheet. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title} className="space-y-1">
          <h2 className="px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {section.title}
          </h2>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon
              if (item.status === 'available') {
                return (
                  <li key={item.label}>
                    <NavLink
                      to={item.to}
                      end
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring/50',
                          isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
                        )
                      }
                    >
                      <Icon aria-hidden="true" className="size-4" />
                      {item.label}
                    </NavLink>
                  </li>
                )
              }
              return (
                <li key={item.label}>
                  <span
                    aria-disabled="true"
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground"
                  >
                    <Icon aria-hidden="true" className="size-4" />
                    <span className="flex-1">{item.label}</span>
                    <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[0.6875rem] font-medium">
                      Phase {item.phase}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
