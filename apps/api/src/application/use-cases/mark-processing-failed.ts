import type { MediaRepository } from '../ports/media-repository'
import type { Clock } from '../ports/system'

/** Gives up on a media item after the processing job exhausted its retries. */
export class MarkProcessingFailed {
  constructor(
    private readonly repo: MediaRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { mediaId: string; reason: string }): Promise<void> {
    const media = await this.repo.findById(input.mediaId)
    if (media?.status !== 'processing') return
    media.markFailed(input.reason, this.clock.now())
    await this.repo.update(media)
  }
}
