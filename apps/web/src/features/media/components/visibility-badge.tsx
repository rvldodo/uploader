import type { MediaVisibility } from '@media-upload/contracts'
import { GlobeIcon, LockIcon } from '~/components/icons'
import { cn } from '~/lib/cn'

export function VisibilityBadge({
  visibility,
  className,
}: {
  visibility: MediaVisibility
  className?: string
}) {
  const isPublic = visibility === 'public'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        isPublic ? 'bg-accent/15 text-accent' : 'bg-surface-2 text-fg-muted',
        className,
      )}
    >
      {isPublic ? <GlobeIcon /> : <LockIcon />}
      {isPublic ? 'Public' : 'Private'}
    </span>
  )
}
