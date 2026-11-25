import { cn } from '@/lib/utils'

/** Initials avatar (no photos are stored or loaded). Decorative: the name is shown next to it. */
export function UserAvatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground',
        className,
      )}
    >
      {initials}
    </span>
  )
}
