import { and, asc, eq } from 'drizzle-orm'
import type {
  MediaShare,
  MediaShareRepository,
} from '../../application/ports/media-share-repository'
import type { Database } from './client'
import { mediaSharesTable } from './schema'

export class DrizzleMediaShareRepository implements MediaShareRepository {
  constructor(private readonly db: Database) {}

  async add(share: MediaShare): Promise<void> {
    await this.db.insert(mediaSharesTable).values(share).onConflictDoNothing()
  }

  async remove(mediaId: string, userId: string): Promise<void> {
    await this.db.delete(mediaSharesTable).where(this.match(mediaId, userId))
  }

  async exists(mediaId: string, userId: string): Promise<boolean> {
    const rows = await this.db
      .select({ mediaId: mediaSharesTable.mediaId })
      .from(mediaSharesTable)
      .where(this.match(mediaId, userId))
      .limit(1)
    return rows.length > 0
  }

  listForMedia(mediaId: string): Promise<MediaShare[]> {
    return this.db
      .select()
      .from(mediaSharesTable)
      .where(eq(mediaSharesTable.mediaId, mediaId))
      .orderBy(asc(mediaSharesTable.createdAt))
  }

  private match(mediaId: string, userId: string) {
    return and(eq(mediaSharesTable.mediaId, mediaId), eq(mediaSharesTable.userId, userId))
  }
}
