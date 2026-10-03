import type { MediaKind, MediaListScope } from '@media-upload/contracts'
import { useSuspenseInfiniteQuery } from '@tanstack/react-query'
import { Button } from '~/components/button'
import { ImageIcon } from '~/components/icons'
import { mediaListQuery } from '../api/media.queries'
import { MediaCard } from './media-card'

export function MediaGrid({ scope, kind }: { scope: MediaListScope; kind?: MediaKind }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(
    mediaListQuery(scope, kind),
  )
  const items = data.pages.flatMap((p) => p.items)

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-border border-dashed py-16 text-center">
        <ImageIcon className="text-3xl text-fg-subtle" />
        <p className="font-medium">Nothing here yet</p>
        <p className="text-sm text-fg-muted">
          {scope === 'shared'
            ? 'Files other people share with you will show up here.'
            : 'Your uploads will show up here.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((media) => (
          <li key={media.id}>
            <MediaCard media={media} />
          </li>
        ))}
      </ul>
      {hasNextPage && (
        <div className="flex justify-center">
          <Button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  )
}

export function MediaGridSkeleton() {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
      {Array.from({ length: 8 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
        <li key={i} className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="aspect-[4/3] animate-pulse bg-surface-2" />
          <div className="m-3 h-4 w-2/3 animate-pulse rounded bg-surface-2" />
        </li>
      ))}
    </ul>
  )
}
