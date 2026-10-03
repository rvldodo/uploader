import type { MediaStatus } from '@media-upload/contracts'
import { SpinnerIcon } from '~/components/icons'
import { cn } from '~/lib/cn'

const styles: Record<MediaStatus, string> = {
  uploading: 'bg-surface-2 text-fg-muted',
  processing: 'bg-warning/15 text-warning',
  ready: 'bg-success/15 text-success',
  failed: 'bg-danger/15 text-danger',
  cancelled: 'bg-surface-2 text-fg-subtle',
}

const labels: Record<MediaStatus, string> = {
  uploading: 'Uploading',
  processing: 'Processing',
  ready: 'Ready',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

export function MediaStatusBadge({
  status,
  className,
}: {
  status: MediaStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        styles[status],
        className,
      )}
    >
      {status === 'processing' && <SpinnerIcon />}
      {labels[status]}
    </span>
  )
}
