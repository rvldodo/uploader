import type {
  ListMediaCriteria,
  MediaRepository,
} from '../../src/application/ports/media-repository'
import { ConcurrencyError, NotFoundError } from '../../src/domain/errors'
import { Media, type MediaSnapshot } from '../../src/domain/media/media'
import type { InMemoryMediaShareRepository } from './in-memory-auth'

/** Behaves like the real repository, including optimistic concurrency. */
export class InMemoryMediaRepository implements MediaRepository {
  readonly rows = new Map<string, MediaSnapshot>()

  constructor(private readonly shares: InMemoryMediaShareRepository) {}

  async findById(id: string) {
    const row = this.rows.get(id)
    return row ? Media.restore(row) : null
  }

  async insert(media: Media) {
    this.rows.set(media.id, media.toSnapshot())
  }

  async update(media: Media) {
    const current = this.rows.get(media.id)
    if (!current) throw new NotFoundError('not found')
    if (current.version !== media.version) throw new ConcurrencyError('conflict')
    this.rows.set(media.id, { ...media.toSnapshot(), version: media.version + 1 })
    media.markPersisted()
  }

  async delete(id: string) {
    this.rows.delete(id)
    this.shares.removeForMedia(id)
  }

  async list(c: ListMediaCriteria) {
    return [...this.rows.values()]
      .filter((r) => c.statuses.includes(r.status) && (!c.kind || r.kind === c.kind))
      .filter((r) => !c.ownerId || r.ownerId === c.ownerId)
      .filter(
        (r) =>
          !c.sharedWithUserId ||
          this.shares.rows.some((s) => s.mediaId === r.id && s.userId === c.sharedWithUserId),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
      .filter(
        (r) =>
          !c.after ||
          r.createdAt < c.after.createdAt ||
          (r.createdAt.getTime() === c.after.createdAt.getTime() && r.id < c.after.id),
      )
      .slice(0, c.limit)
      .map((r) => Media.restore(r))
  }

  async findStaleUploads(createdBefore: Date, limit: number) {
    return [...this.rows.values()]
      .filter((r) => r.status === 'uploading' && r.createdAt < createdBefore)
      .slice(0, limit)
      .map((r) => Media.restore(r))
  }
}
