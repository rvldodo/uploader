import type { MediaDto } from '@media-upload/contracts'
import { NotFoundError } from '../../domain/errors'
import type { Viewer } from '../actor'
import type { MediaAccessGuard } from '../media-access-guard'
import type { MediaViewFactory } from '../media-view'

/** Works for anonymous visitors too: public media needs no login. */
export class GetMedia {
  constructor(
    private readonly guard: MediaAccessGuard,
    private readonly views: MediaViewFactory,
  ) {}

  async execute(viewer: Viewer, input: { mediaId: string }): Promise<MediaDto> {
    const { media } = await this.guard.requireViewable(input.mediaId, viewer)
    // Cancelled uploads are tombstones, not library items, even for their owner.
    if (media.status === 'cancelled') throw new NotFoundError(`Media ${input.mediaId} not found`)
    return this.views.toView(media, viewer)
  }
}
