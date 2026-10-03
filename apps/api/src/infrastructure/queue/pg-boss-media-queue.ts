import type { PgBoss } from 'pg-boss'
import type { MediaProcessingQueue } from '../../application/ports/media-processing-queue'

export const QUEUES = {
  processMedia: 'media.process',
  expireStaleUploads: 'uploads.expire-stale',
  purgeExpiredSessions: 'auth.purge-expired-sessions',
} as const

export interface ProcessMediaJob {
  mediaId: string
}

/**
 * Postgres-backed job queue. Using the database we already run means no extra
 * infrastructure, and jobs are as durable as the data they refer to.
 */
export class PgBossMediaQueue implements MediaProcessingQueue {
  constructor(private readonly boss: PgBoss) {}

  async enqueue(mediaId: string): Promise<void> {
    await this.boss.send(QUEUES.processMedia, { mediaId } satisfies ProcessMediaJob, {
      // At most one queued job per media item, even if "complete" is retried.
      singletonKey: mediaId,
    })
  }
}
