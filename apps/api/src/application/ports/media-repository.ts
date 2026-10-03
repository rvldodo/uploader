import type { Media, MediaKind, MediaStatus } from '../../domain/media/media'

/** Keyset pagination position: items strictly "older" than this are returned. */
export interface MediaCursor {
  createdAt: Date
  id: string
}

export interface ListMediaCriteria {
  /** Exactly one of `ownerId` / `sharedWithUserId` selects whose library to list. */
  ownerId?: string
  sharedWithUserId?: string
  limit: number
  after?: MediaCursor
  kind?: MediaKind
  statuses: readonly MediaStatus[]
}

export interface MediaRepository {
  findById(id: string): Promise<Media | null>
  insert(media: Media): Promise<void>
  /**
   * Persists changes using optimistic concurrency on `media.version`.
   * @throws ConcurrencyError if the row changed since it was loaded.
   * @throws NotFoundError if the row no longer exists.
   */
  update(media: Media): Promise<void>
  delete(id: string): Promise<void>
  /** Newest first. Returns at most `limit` items. */
  list(criteria: ListMediaCriteria): Promise<Media[]>
  /** Media still `uploading` that were created before `createdBefore`. */
  findStaleUploads(createdBefore: Date, limit: number): Promise<Media[]>
}
