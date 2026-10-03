import type { MediaDto, MediaVisibility } from '@media-upload/contracts'
import type { Actor } from '../actor'
import type { MediaAccessGuard } from '../media-access-guard'
import type { MediaViewFactory } from '../media-view'
import type { MediaRepository } from '../ports/media-repository'
import type { Clock } from '../ports/system'

export class UpdateMediaVisibility {
  constructor(
    private readonly repo: MediaRepository,
    private readonly guard: MediaAccessGuard,
    private readonly views: MediaViewFactory,
    private readonly clock: Clock,
  ) {}

  async execute(
    actor: Actor,
    input: { mediaId: string; visibility: MediaVisibility },
  ): Promise<MediaDto> {
    const media = await this.guard.requireOwned(input.mediaId, actor)
    if (media.visibility !== input.visibility) {
      media.changeVisibility(input.visibility, this.clock.now())
      await this.repo.update(media)
    }
    return this.views.toView(media, actor)
  }
}
