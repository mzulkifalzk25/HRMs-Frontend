import { Link } from 'react-router'
import { APP_NAME } from '@/constants/app'

export function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      to="/"
      onClick={onNavigate}
      className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
      >
        F
      </span>
      <span className="text-base font-semibold tracking-tight">{APP_NAME}</span>
    </Link>
  )
}
