import { ForbiddenError, NotFoundError } from '../domain/errors'
import type { Media } from '../domain/media/media'
import { type MediaAccess, resolveMediaAccess } from '../domain/media/media-access'
import type { Actor, Viewer } from './actor'
import type { MediaRepository } from './ports/media-repository'
import type { MediaShareRepository } from './ports/media-share-repository'

/**
 * Loads media and enforces access in one step, so no use case can forget the
 * check. Items the viewer may not see are reported as "not found", which
 * avoids leaking that a private file exists.
 */
export class MediaAccessGuard {
  constructor(
    private readonly repo: MediaRepository,
    private readonly shares: MediaShareRepository,
  ) {}

  async requireViewable(
    mediaId: string,
    viewer: Viewer,
  ): Promise<{ media: Media; access: MediaAccess }> {
    const media = await this.repo.findById(mediaId)
    if (!media) throw notFound(mediaId)

    const viewerId = viewer?.userId ?? null
    // Only hit the shares table when it can change the outcome.
    const shared =
      viewerId !== null && !media.isOwnedBy(viewerId) && media.status === 'ready'
        ? await this.shares.exists(media.id, viewerId)
        : false

    const access = resolveMediaAccess(media, viewerId, shared)
    if (access === 'none') throw notFound(mediaId)
    return { media, access }
  }

  async requireOwned(mediaId: string, actor: Actor): Promise<Media> {
    const { media, access } = await this.requireViewable(mediaId, actor)
    if (access !== 'owner') throw new ForbiddenError('Only the owner can do this')
    return media
  }
}

const notFound = (id: string) => new NotFoundError(`Media ${id} not found`)
