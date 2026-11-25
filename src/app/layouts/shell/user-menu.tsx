import { LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/** User menu placeholder (P1-T14). Sign-in, profile and sign-out arrive in Phase 2. */
export function UserMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account menu" className="rounded-full">
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground"
          >
            <User className="size-4" />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="space-y-0.5">
          <span className="block text-sm font-medium">Not signed in</span>
          <span className="block text-xs font-normal text-muted-foreground">
            Sign-in arrives in Phase 2.
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <User aria-hidden="true" />
          My profile
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
