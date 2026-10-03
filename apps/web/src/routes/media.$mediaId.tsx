import { mediaIdSchema } from '@media-upload/contracts'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, notFound, useLocation } from '@tanstack/react-router'
import { ArrowLeftIcon } from '~/components/icons'
import { NotFound } from '~/components/not-found'
import { useCurrentUser } from '~/features/auth/use-auth'
import { mediaDetailQuery } from '~/features/media/api/media.queries'
import { DeleteMediaButton } from '~/features/media/components/delete-media-button'
import { MediaDetails } from '~/features/media/components/media-details'
import { MediaViewer } from '~/features/media/components/media-viewer'
import { SharingPanel } from '~/features/media/components/sharing-panel'

/**
 * Deliberately outside the `_app` guard: public files are viewable without an
 * account. The API decides what the current viewer may see.
 */
export const Route = createFileRoute('/media/$mediaId')({
  loader: async ({ context, params }) => {
    if (!mediaIdSchema.safeParse(params.mediaId).success) throw notFound()
    try {
      const media = await context.queryClient.ensureQueryData(mediaDetailQuery(params.mediaId))
      return { title: media.filename }
    } catch (err) {
      if (err instanceof Error && /not found/i.test(err.message)) throw notFound()
      throw err
    }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.title} · Mediabox` : 'Mediabox' }],
  }),
  notFoundComponent: MediaNotFound,
  component: MediaPage,
})

function MediaPage() {
  const { mediaId } = Route.useParams()
  const { data: media } = useSuspenseQuery(mediaDetailQuery(mediaId))
  const user = useCurrentUser()
  const isOwner = media.viewerRole === 'owner'

  return (
    <div className="space-y-6">
      {user && (
        <Link
          to="/"
          search={isOwner ? {} : { scope: 'shared' }}
          className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
        >
          <ArrowLeftIcon /> {isOwner ? 'My files' : 'Shared with me'}
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <MediaViewer media={media} />
        <aside className="space-y-4">
          <div>
            <h1 className="break-words text-lg font-semibold tracking-tight">{media.filename}</h1>
            {!isOwner && (
              <p className="mt-0.5 text-sm text-fg-muted">Shared by {media.owner.name}</p>
            )}
          </div>
          <MediaDetails media={media} />
          {media.status === 'ready' && media.url && (
            <a
              href={media.url}
              download={media.filename}
              className="flex h-10 w-full items-center justify-center rounded-lg bg-accent text-sm font-medium text-accent-fg hover:bg-accent/90"
            >
              Open original
            </a>
          )}
          {isOwner && (
            <>
              {media.status === 'ready' && <SharingPanel media={media} />}
              <DeleteMediaButton mediaId={media.id} />
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

/** Private and missing look identical on purpose; offer a login if that might help. */
function MediaNotFound() {
  const user = useCurrentUser()
  const location = useLocation()
  if (user)
    return <NotFound message="This file doesn't exist, or it hasn't been shared with you." />
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
      <p className="text-lg font-semibold">This file is private or doesn't exist</p>
      <p className="text-fg-muted">If someone shared it with you, log in to view it.</p>
      <Link
        to="/login"
        search={{ redirect: location.href }}
        className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent/90"
      >
        Log in
      </Link>
    </div>
  )
}
