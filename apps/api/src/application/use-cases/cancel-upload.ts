import type { Media } from '../../domain/media/media'
import { mediaStorageKeys } from '../../domain/media/storage-keys'
import type { Actor } from '../actor'
import type { MediaAccessGuard } from '../media-access-guard'
import type { MediaRepository } from '../ports/media-repository'
import type { ObjectStorage } from '../ports/object-storage'
import type { Clock } from '../ports/system'

/**
 * Shared mechanics for stopping an upload, used by both the user-facing
 * cancel and the stale-upload sweeper.
 */
export class UploadCanceller {
  constructor(
    private readonly repo: MediaRepository,
    private readonly storage: ObjectStorage,
    private readonly clock: Clock,
  ) {}

  async cancel(media: Media, reason: string): Promise<void> {
    if (media.status === 'cancelled') return

    const uploadId = media.multipartUploadId
    media.cancel(reason, this.clock.now())
    await this.repo.update(media)

    // Release storage after the state change is durable; a failure here only
    // leaves garbage that the bucket lifecycle rule will reclaim.
    if (uploadId) await this.storage.abortMultipartUpload(media.storageKey, uploadId)
    await this.storage.deletePrefix(mediaStorageKeys.prefix(media.id))
  }
}

/** Aborts one of the actor's own in-flight uploads. */
export class CancelUpload {
  constructor(
    private readonly guard: MediaAccessGuard,
    private readonly canceller: UploadCanceller,
  ) {}

  async execute(actor: Actor, input: { mediaId: string }): Promise<void> {
    const media = await this.guard.requireOwned(input.mediaId, actor)
    await this.canceller.cancel(media, 'Cancelled by user')
  }
}
