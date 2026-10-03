import { and, desc, eq, inArray, lt, or, type SQL } from 'drizzle-orm'
import type { ListMediaCriteria, MediaRepository } from '../../application/ports/media-repository'
import { ConcurrencyError, NotFoundError } from '../../domain/errors'
import { Media } from '../../domain/media/media'
import type { Database } from './client'
import { type MediaRow, mediaSharesTable, mediaTable } from './schema'

export class DrizzleMediaRepository implements MediaRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Media | null> {
    const [row] = await this.db.select().from(mediaTable).where(eq(mediaTable.id, id)).limit(1)
    return row ? toDomain(row) : null
  }

  async insert(media: Media): Promise<void> {
    await this.db.insert(mediaTable).values(media.toSnapshot())
  }

  async update(media: Media): Promise<void> {
    const { id, version, createdAt: _createdAt, ...changes } = media.toSnapshot()
    const updated = await this.db
      .update(mediaTable)
      .set({ ...changes, version: version + 1 })
      .where(and(eq(mediaTable.id, id), eq(mediaTable.version, version)))
      .returning({ id: mediaTable.id })

    if (updated.length === 0) {
      const exists = await this.findById(id)
      if (!exists) throw new NotFoundError(`Media ${id} not found`)
      throw new ConcurrencyError(`Media ${id} was modified concurrently, please retry`)
    }
    media.markPersisted()
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(mediaTable).where(eq(mediaTable.id, id))
  }

  async list(criteria: ListMediaCriteria): Promise<Media[]> {
    const filters: (SQL | undefined)[] = [inArray(mediaTable.status, [...criteria.statuses])]
    if (criteria.ownerId) filters.push(eq(mediaTable.ownerId, criteria.ownerId))
    if (criteria.kind) filters.push(eq(mediaTable.kind, criteria.kind))
    if (criteria.after) {
      // Keyset pagination: (created_at, id) < (cursor.createdAt, cursor.id)
      const { createdAt, id } = criteria.after
      filters.push(
        or(
          lt(mediaTable.createdAt, createdAt),
          and(eq(mediaTable.createdAt, createdAt), lt(mediaTable.id, id)),
        ),
      )
    }

    const base = this.db.select({ media: mediaTable }).from(mediaTable)
    const query = criteria.sharedWithUserId
      ? base.innerJoin(
          mediaSharesTable,
          and(
            eq(mediaSharesTable.mediaId, mediaTable.id),
            eq(mediaSharesTable.userId, criteria.sharedWithUserId),
          ),
        )
      : base

    const rows = await query
      .where(and(...filters))
      .orderBy(desc(mediaTable.createdAt), desc(mediaTable.id))
      .limit(criteria.limit)
    return rows.map((r) => toDomain(r.media))
  }

  async findStaleUploads(createdBefore: Date, limit: number): Promise<Media[]> {
    const rows = await this.db
      .select()
      .from(mediaTable)
      .where(and(eq(mediaTable.status, 'uploading'), lt(mediaTable.createdAt, createdBefore)))
      .orderBy(mediaTable.createdAt)
      .limit(limit)
    return rows.map(toDomain)
  }
}

function toDomain(row: MediaRow): Media {
  return Media.restore(row)
}
