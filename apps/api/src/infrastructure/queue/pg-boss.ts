import { PgBoss } from 'pg-boss'
import { QUEUES } from './pg-boss-media-queue'

export interface PgBossOptions {
  connectionString: string
  /** Only the worker process runs maintenance & cron; API processes just enqueue. */
  role: 'producer' | 'worker'
  processingRetryLimit: number
}

export async function startPgBoss(options: PgBossOptions): Promise<PgBoss> {
  const isWorker = options.role === 'worker'
  const boss = new PgBoss({
    connectionString: options.connectionString,
    schema: 'pgboss',
    max: 4,
    supervise: isWorker,
    schedule: isWorker,
  })
  await boss.start()

  // Queues must exist before jobs can be sent; creation is idempotent.
  await boss.createQueue(QUEUES.processMedia, {
    retryLimit: options.processingRetryLimit,
    retryDelay: 15,
    retryBackoff: true,
    expireInSeconds: 15 * 60, // a single video should never take longer than this
    retentionSeconds: 7 * 24 * 3600,
  })
  await boss.createQueue(QUEUES.expireStaleUploads, { retryLimit: 0 })
  await boss.createQueue(QUEUES.purgeExpiredSessions, { retryLimit: 0 })
  return boss
}
