import type { UploadSnapshot } from '@media-upload/upload-engine'
import { Link } from '@tanstack/react-router'
import { Button } from '~/components/button'
import {
  AlertIcon,
  CheckIcon,
  ImageIcon,
  RetryIcon,
  SpinnerIcon,
  VideoIcon,
  XIcon,
} from '~/components/icons'
import { cn } from '~/lib/cn'
import { formatBytes } from '~/lib/format'

interface Props {
  upload: UploadSnapshot
  onCancel: () => void
  onRetry: () => void
  onDismiss: () => void
}

export function UploadItem({ upload, onCancel, onRetry, onDismiss }: Props) {
  const percent = upload.fileSize
    ? Math.min(100, (upload.uploadedBytes / upload.fileSize) * 100)
    : 0
  const isVideo = upload.mimeType.startsWith('video/')

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-lg text-fg-muted">
        {isVideo ? <VideoIcon /> : <ImageIcon />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-sm font-medium" title={upload.fileName}>
            {upload.fileName}
          </p>
          <StatusText upload={upload} percent={percent} />
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-label={`Upload progress for ${upload.fileName}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-300',
              upload.status === 'failed' && 'bg-danger',
              upload.status === 'cancelled' && 'bg-fg-subtle',
              upload.status === 'completed' && 'bg-success',
              (upload.status === 'uploading' || upload.status === 'queued') && 'bg-accent',
              upload.status === 'finalizing' && 'animate-pulse bg-accent',
            )}
            style={{ width: `${upload.status === 'failed' ? 100 : percent}%` }}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {(upload.status === 'queued' || upload.status === 'uploading') && (
          <Button size="icon" variant="ghost" onClick={onCancel} aria-label="Cancel upload">
            <XIcon />
          </Button>
        )}
        {(upload.status === 'failed' || upload.status === 'cancelled') && (
          <Button size="icon" variant="ghost" onClick={onRetry} aria-label="Retry upload">
            <RetryIcon />
          </Button>
        )}
        {(upload.status === 'completed' ||
          upload.status === 'failed' ||
          upload.status === 'cancelled') && (
          <Button size="icon" variant="ghost" onClick={onDismiss} aria-label="Dismiss">
            <XIcon />
          </Button>
        )}
      </div>
    </li>
  )
}

function StatusText({ upload, percent }: { upload: UploadSnapshot; percent: number }) {
  const base = 'flex shrink-0 items-center gap-1 text-xs tabular-nums'
  switch (upload.status) {
    case 'queued':
      return <span className={cn(base, 'text-fg-subtle')}>Waiting…</span>
    case 'uploading': {
      const eta =
        upload.bytesPerSecond > 0
          ? Math.ceil((upload.fileSize - upload.uploadedBytes) / upload.bytesPerSecond)
          : null
      return (
        <span className={cn(base, 'text-fg-muted')}>
          {Math.floor(percent)}% · {formatBytes(upload.uploadedBytes)} of{' '}
          {formatBytes(upload.fileSize)}
          {eta !== null && eta > 1 && ` · ${eta < 60 ? `${eta}s` : `${Math.ceil(eta / 60)}m`} left`}
        </span>
      )
    }
    case 'finalizing':
      return (
        <span className={cn(base, 'text-fg-muted')}>
          <SpinnerIcon /> Finalizing
        </span>
      )
    case 'completed':
      return (
        <span className={cn(base, 'text-success')}>
          <CheckIcon /> Uploaded
          {upload.mediaId && (
            <Link
              to="/media/$mediaId"
              params={{ mediaId: upload.mediaId }}
              className="ml-1 font-medium text-accent hover:underline"
            >
              View
            </Link>
          )}
        </span>
      )
    case 'failed':
      return (
        <span className={cn(base, 'max-w-[60%] text-danger')} title={upload.error ?? undefined}>
          <AlertIcon className="shrink-0" />
          <span className="truncate">{upload.error}</span>
        </span>
      )
    case 'cancelled':
      return <span className={cn(base, 'text-fg-subtle')}>Cancelled</span>
  }
}
