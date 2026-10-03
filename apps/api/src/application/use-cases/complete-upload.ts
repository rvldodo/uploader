import type { CompletedPart, MediaDto } from '@media-upload/contracts'
import { UploadVerificationError, ValidationError } from '../../domain/errors'
import type { Actor } from '../actor'
import type { MediaAccessGuard } from '../media-access-guard'
import type { MediaViewFactory } from '../media-view'
import type { MediaProcessingQueue } from '../ports/media-processing-queue'
import type { MediaRepository } from '../ports/media-repository'
import type { ObjectStorage } from '../ports/object-storage'
import type { Clock } from '../ports/system'

/**
 * Step 2 of an upload: the client says "I'm done". We never trust that claim —
 * the object is stat'ed in storage and its size compared to what was declared
 * before the media moves on to processing.
 */
export class CompleteUpload {
  constructor(
    private readonly repo: MediaRepository,
    private readonly guard: MediaAccessGuard,
    private readonly storage: ObjectStorage,
    private readonly queue: MediaProcessingQueue,
    private readonly views: MediaViewFactory,
    private readonly clock: Clock,
  ) {}

  async execute(
    actor: Actor,
    input: { mediaId: string; parts?: CompletedPart[] },
  ): Promise<MediaDto> {
    const media = await this.guard.requireOwned(input.mediaId, actor)

    // Idempotency: a retried "complete" after a lost response should succeed.
    if (media.status === 'processing' || media.status === 'ready') {
      return this.views.toView(media, actor)
    }
    media.ensureUploading()

    const uploadId = media.multipartUploadId
    if (uploadId) {
      if (!input.parts?.length)
        throw new ValidationError('parts are required for multipart uploads')
      const parts = [...input.parts].sort((a, b) => a.partNumber - b.partNumber)
      await this.storage.completeMultipartUpload(media.storageKey, uploadId, parts)
    }

    const stored = await this.storage.stat(media.storageKey)
    if (!stored) throw new UploadVerificationError('No uploaded object found in storage')

    media.markUploaded(stored.sizeBytes, this.clock.now())
    await this.repo.update(media)
    await this.queue.enqueue(media.id)

    return this.views.toView(media, actor)
  }
}
