import type { MediaDto } from '@media-upload/contracts'
import { AlertIcon, SpinnerIcon } from '~/components/icons'

export function MediaViewer({ media }: { media: MediaDto }) {
  if (media.status === 'processing') {
    return (
      <Frame>
        <SpinnerIcon className="text-3xl" />
        <p className="text-sm">Processing — this page updates automatically.</p>
      </Frame>
    )
  }
  if (media.status !== 'ready' || !media.url) {
    return (
      <Frame className="text-danger">
        <AlertIcon className="text-3xl" />
        <p className="text-sm">{media.failureReason ?? 'This file could not be processed.'}</p>
      </Frame>
    )
  }

  return (
    <div className="flex items-center justify-center overflow-hidden rounded-2xl bg-black">
      {media.kind === 'video' ? (
        // biome-ignore lint/a11y/useMediaCaption: user-uploaded videos have no caption track
        <video
          key={media.id}
          src={media.url}
          poster={media.thumbnailUrl ?? undefined}
          controls
          playsInline
          preload="metadata"
          className="max-h-[75vh] w-full"
        />
      ) : (
        <img src={media.url} alt={media.filename} className="max-h-[75vh] w-auto object-contain" />
      )}
    </div>
  )
}

function Frame({
  children,
  className = 'text-fg-muted',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`flex aspect-video flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-surface ${className}`}
    >
      {children}
    </div>
  )
}
