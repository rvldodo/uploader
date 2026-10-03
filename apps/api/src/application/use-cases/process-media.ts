import { mediaStorageKeys } from '../../domain/media/storage-keys'
import { type MediaAnalyzer, UnprocessableMediaError } from '../ports/media-analyzer'
import type { MediaRepository } from '../ports/media-repository'
import type { ObjectStorage } from '../ports/object-storage'
import type { Clock, Logger } from '../ports/system'

export type ProcessMediaOutcome = 'ready' | 'failed' | 'skipped'

/**
 * Background step: extract metadata and render a thumbnail.
 *
 * - Idempotent: jobs may be delivered more than once; anything not in
 *   `processing` is skipped.
 * - Bad content (corrupt file, wrong format) fails the media immediately.
 * - Infrastructure errors propagate so the queue retries with backoff;
 *   `MarkProcessingFailed` handles the final attempt.
 */
export class ProcessMedia {
  constructor(
    private readonly repo: MediaRepository,
    private readonly storage: ObjectStorage,
    private readonly analyzer: MediaAnalyzer,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {}

  async execute(input: { mediaId: string }): Promise<ProcessMediaOutcome> {
    const media = await this.repo.findById(input.mediaId)
    if (media?.status !== 'processing') {
      this.logger.info(
        { mediaId: input.mediaId, status: media?.status },
        'skipping media processing',
      )
      return 'skipped'
    }

    const file = await this.storage.downloadToTempFile(media.storageKey)
    try {
      const analysis = await this.analyzer.analyze(media.kind, file.path)
      const thumbnailKey = mediaStorageKeys.thumbnail(media.id)
      await this.storage.put(thumbnailKey, analysis.thumbnail, 'image/webp')

      media.markReady({ ...analysis, thumbnailKey }, this.clock.now())
      await this.repo.update(media)
      return 'ready'
    } catch (error) {
      if (!(error instanceof UnprocessableMediaError)) throw error

      this.logger.warn({ mediaId: media.id, err: error }, 'media content could not be processed')
      media.markFailed(error.message, this.clock.now())
      await this.repo.update(media)
      return 'failed'
    } finally {
      await file.dispose()
    }
  }
}
