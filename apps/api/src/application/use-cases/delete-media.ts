import { mediaStorageKeys } from '../../domain/media/storage-keys'
import type { Actor } from '../actor'
import type { MediaAccessGuard } from '../media-access-guard'
import type { MediaRepository } from '../ports/media-repository'
import type { ObjectStorage } from '../ports/object-storage'

/**
 * Permanently deletes a media item and all of its objects (owner only).
 *
 * Objects are removed *before* the row: if we crash in between, a retry finds
 * the row and finishes the job. The opposite order would leak orphaned objects
 * that nothing references any more. Shares are removed by the FK cascade.
 */
export class DeleteMedia {
  constructor(
    private readonly repo: MediaRepository,
    private readonly guard: MediaAccessGuard,
    private readonly storage: ObjectStorage,
  ) {}

  async execute(actor: Actor, input: { mediaId: string }): Promise<void> {
    const media = await this.guard.requireOwned(input.mediaId, actor)

    if (media.multipartUploadId) {
      await this.storage.abortMultipartUpload(media.storageKey, media.multipartUploadId)
    }
    await this.storage.deletePrefix(mediaStorageKeys.prefix(media.id))
    await this.repo.delete(media.id)
  }
}
