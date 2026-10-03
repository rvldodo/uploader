import { MEDIA_LIST_SCOPES, mediaKindSchema } from '@media-upload/contracts'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Suspense } from 'react'
import { z } from 'zod'
import { mediaListQuery } from '~/features/media/api/media.queries'
import { MediaGrid, MediaGridSkeleton } from '~/features/media/components/media-grid'
import { UploadPanel } from '~/features/upload/components/upload-panel'
import { cn } from '~/lib/cn'

const searchSchema = z.object({
  scope: z.enum(MEDIA_LIST_SCOPES).optional().catch(undefined),
  kind: mediaKindSchema.optional().catch(undefined),
})

export const Route = createFileRoute('/_app/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ scope: search.scope ?? 'mine', kind: search.kind }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureInfiniteQueryData(mediaListQuery(deps.scope, deps.kind)),
  component: LibraryPage,
})

const SCOPES = [
  { label: 'My files', scope: undefined },
  { label: 'Shared with me', scope: 'shared' },
] as const

const KINDS = [
  { label: 'All', kind: undefined },
  { label: 'Images', kind: 'image' },
  { label: 'Videos', kind: 'video' },
] as const

function LibraryPage() {
  const search = Route.useSearch()
  const scope = search.scope ?? 'mine'

  return (
    <div className="space-y-10">
      {scope === 'mine' && <UploadPanel />}

      <section aria-labelledby="library-heading" className="space-y-4">
        <h1 id="library-heading" className="sr-only">
          Library
        </h1>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Library" className="flex gap-1">
            {SCOPES.map((s) => (
              <Link
                key={s.label}
                to="/"
                search={{ scope: s.scope, kind: search.kind }}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                  (s.scope ?? 'mine') === scope
                    ? 'bg-surface-2 text-fg'
                    : 'text-fg-muted hover:text-fg',
                )}
              >
                {s.label}
              </Link>
            ))}
          </nav>
          <nav
            aria-label="Filter by type"
            className="flex rounded-lg border border-border bg-surface p-0.5"
          >
            {KINDS.map((k) => (
              <Link
                key={k.label}
                to="/"
                search={{ scope: search.scope, kind: k.kind }}
                className={cn(
                  'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                  search.kind === k.kind ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:text-fg',
                )}
              >
                {k.label}
              </Link>
            ))}
          </nav>
        </div>
        <Suspense fallback={<MediaGridSkeleton />}>
          <MediaGrid scope={scope} kind={search.kind} />
        </Suspense>
      </section>
    </div>
  )
}
