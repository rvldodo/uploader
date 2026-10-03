import type { MediaDto } from '@media-upload/contracts'
import { Link } from '@tanstack/react-router'
import {
  AlertIcon,
  GlobeIcon,
  ImageIcon,
  PlayIcon,
  SpinnerIcon,
  VideoIcon,
} from '~/components/icons'
import { formatBytes, formatDuration } from '~/lib/format'

export function MediaCard({ media }: { media: MediaDto }) {
  return (
    <Link
      to="/media/$mediaId"
      params={{ mediaId: media.id }}
      className="group block overflow-hidden rounded-xl border border-border bg-surface transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
        <Thumbnail media={media} />
        {media.viewerRole === 'owner' && media.visibility === 'public' && (
          <span
            className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white backdrop-blur"
            title="Anyone with the link can view"
          >
            <GlobeIcon /> Public
          </span>
        )}
        {media.kind === 'video' && media.status === 'ready' && (
          <>
            <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-lg text-white backdrop-blur">
                <PlayIcon />
              </span>
            </span>
            {media.durationMs !== null && (
              <span className="absolute right-2 bottom-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white tabular-nums">
                {formatDuration(media.durationMs)}
              </span>
            )}
          </>
        )}
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="text-fg-subtle">
          {media.kind === 'video' ? <VideoIcon /> : <ImageIcon />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={media.filename}>
            {media.filename}
          </p>
          {media.viewerRole === 'viewer' && (
            <p className="truncate text-xs text-fg-muted">From {media.owner.name}</p>
          )}
        </div>
        <span className="shrink-0 text-xs text-fg-subtle tabular-nums">
          {formatBytes(media.sizeBytes)}
        </span>
      </div>
    </Link>
  )
}

function Thumbnail({ media }: { media: MediaDto }) {
  if (media.status === 'ready' && media.thumbnailUrl) {
    return (
      <img
        src={media.thumbnailUrl}
        alt={media.filename}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />
    )
  }
  if (media.status === 'failed') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1.5 px-4 text-center text-danger">
        <AlertIcon className="text-2xl" />
        <span className="text-xs">{media.failureReason ?? 'Processing failed'}</span>
      </div>
    )
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-fg-muted">
      <SpinnerIcon className="text-2xl" />
      <span className="text-xs">Processing…</span>
    </div>
  )
}
