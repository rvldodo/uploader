import type {
  InitiateUploadRequest,
  InitiateUploadResponse,
  UploadInstructions,
} from '@media-upload/contracts'
import { Media } from '../../domain/media/media'
import type { Actor } from '../actor'
import type { MediaRepository } from '../ports/media-repository'
import type { ObjectStorage } from '../ports/object-storage'
import type { Clock, IdGenerator } from '../ports/system'
import { planUpload } from '../upload-plan'

export interface InitiateUploadConfig {
  partSizeBytes: number
  uploadUrlTtlSeconds: number
}

/**
 * Step 1 of an upload: validate the declared file, reserve a Media record and
 * hand back signed URLs so the client can send bytes *directly* to object
 * storage. The API never proxies file content.
 */
export class InitiateUpload {
  constructor(
    private readonly repo: MediaRepository,
    private readonly storage: ObjectStorage,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly config: InitiateUploadConfig,
  ) {}

  async execute(actor: Actor, input: InitiateUploadRequest): Promise<InitiateUploadResponse> {
    const now = this.clock.now()
    const media = Media.create({ id: this.ids.next(), ownerId: actor.userId, ...input, now })
    const plan = planUpload(media.sizeBytes, this.config.partSizeBytes)
    const ttl = this.config.uploadUrlTtlSeconds

    let instructions: UploadInstructions
    if (plan.strategy === 'single') {
      const url = await this.storage.createSignedUploadUrl(media.storageKey, media.mimeType, ttl)
      instructions = { strategy: 'single', url }
    } else {
      const uploadId = await this.storage.createMultipartUpload(media.storageKey, media.mimeType)
      media.attachMultipartUpload(uploadId)
      const parts = await this.storage.createSignedPartUploadUrls(
        media.storageKey,
        uploadId,
        plan.partCount,
        ttl,
      )
      instructions = { strategy: 'multipart', partSize: plan.partSize, parts }
    }

    await this.repo.insert(media)

    return {
      mediaId: media.id,
      expiresAt: new Date(now.getTime() + ttl * 1000).toISOString(),
      instructions,
    }
  }
}
