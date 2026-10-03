import type { MediaDto } from '@media-upload/contracts'
import { formatBytes, formatDate, formatDuration } from '~/lib/format'
import { MediaStatusBadge } from './media-status-badge'
import { VisibilityBadge } from './visibility-badge'

export function MediaDetails({ media }: { media: MediaDto }) {
  const rows: Array<[string, React.ReactNode]> = [
    ['Status', <MediaStatusBadge key="s" status={media.status} />],
    ['Visibility', <VisibilityBadge key="v" visibility={media.visibility} />],
    ['Owner', media.viewerRole === 'owner' ? 'You' : media.owner.name],
    ['Type', media.mimeType],
    ['Size', formatBytes(media.sizeBytes)],
  ]
  if (media.width && media.height) rows.push(['Dimensions', `${media.width} × ${media.height}`])
  if (media.durationMs !== null) rows.push(['Duration', formatDuration(media.durationMs)])
  rows.push(['Uploaded', formatDate(media.createdAt)])

  return (
    <dl className="divide-y divide-border rounded-2xl border border-border bg-surface text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="text-fg-muted">{label}</dt>
          <dd className="text-right font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
