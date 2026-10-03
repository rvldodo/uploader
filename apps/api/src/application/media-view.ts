import type { MediaDto, PublicUserDto } from '@media-upload/contracts'
import type { Media } from '../domain/media/media'
import type { Viewer } from './actor'
import type { ObjectStorage } from './ports/object-storage'
import type { UserRepository } from './ports/user-repository'

/**
 * Builds the public representation of media items, including short-lived
 * signed URLs and owner info. Kept in the application layer because signing
 * is a use-case concern (who may see what, for how long), not an HTTP one.
 *
 * Callers must have checked access already (see MediaAccessGuard).
 */
export class MediaViewFactory {
  constructor(
    private readonly storage: ObjectStorage,
    private readonly users: UserRepository,
    private readonly downloadUrlTtlSeconds: number,
  ) {}

  async toView(media: Media, viewer: Viewer): Promise<MediaDto> {
    const [view] = await this.toViews([media], viewer)
    return view as MediaDto
  }

  /** Batch variant: resolves all owners with a single query. */
  async toViews(items: readonly Media[], viewer: Viewer): Promise<MediaDto[]> {
    const ownerIds = [...new Set(items.map((m) => m.ownerId))]
    const owners = new Map<string, PublicUserDto>(
      (await this.users.findByIds(ownerIds)).map((u) => [u.id, { id: u.id, name: u.name }]),
    )
    return Promise.all(
      items.map((m) =>
        this.build(m, viewer, owners.get(m.ownerId) ?? { id: m.ownerId, name: 'Unknown' }),
      ),
    )
  }

  private async build(media: Media, viewer: Viewer, owner: PublicUserDto): Promise<MediaDto> {
    const s = media.toSnapshot()
    const isReady = s.status === 'ready'
    const [url, thumbnailUrl] = await Promise.all([
      isReady
        ? this.storage.createSignedDownloadUrl(s.storageKey, this.downloadUrlTtlSeconds)
        : null,
      isReady && s.thumbnailKey
        ? this.storage.createSignedDownloadUrl(s.thumbnailKey, this.downloadUrlTtlSeconds)
        : null,
    ])

    return {
      id: s.id,
      kind: s.kind,
      status: s.status,
      visibility: s.visibility,
      owner,
      viewerRole: media.isOwnedBy(viewer?.userId ?? null) ? 'owner' : 'viewer',
      filename: s.filename,
      mimeType: s.mimeType,
      sizeBytes: s.sizeBytes,
      width: s.width,
      height: s.height,
      durationMs: s.durationMs,
      failureReason: s.failureReason,
      url,
      thumbnailUrl,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }
  }
}
