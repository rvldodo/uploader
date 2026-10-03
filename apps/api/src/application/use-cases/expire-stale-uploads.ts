import type { MediaRepository } from '../ports/media-repository'
import type { Clock, Logger } from '../ports/system'
import type { UploadCanceller } from './cancel-upload'

/**
 * Periodic sweep: uploads abandoned mid-way (closed tab, lost network) keep
 * multipart parts in storage forever unless someone aborts them.
 */
export class ExpireStaleUploads {
  constructor(
    private readonly repo: MediaRepository,
    private readonly canceller: UploadCanceller,
    private readonly clock: Clock,
    private readonly logger: Logger,
    private readonly maxAgeSeconds: number,
  ) {}

  async execute(input: { batchSize?: number } = {}): Promise<number> {
    const cutoff = new Date(this.clock.now().getTime() - this.maxAgeSeconds * 1000)
    const stale = await this.repo.findStaleUploads(cutoff, input.batchSize ?? 100)

    let expired = 0
    for (const media of stale) {
      try {
        await this.canceller.cancel(media, 'Upload expired')
        expired++
      } catch (err) {
        // One bad record must not block the rest of the sweep.
        this.logger.warn({ mediaId: media.id, err }, 'failed to expire stale upload')
      }
    }
    if (expired > 0) this.logger.info({ expired }, 'expired stale uploads')
    return expired
  }
}
