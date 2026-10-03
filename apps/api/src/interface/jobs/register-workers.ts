import type { JobWithMetadata, PgBoss } from 'pg-boss'
import type { Logger } from '../../application/ports/system'
import { type ProcessMediaJob, QUEUES } from '../../infrastructure/queue/pg-boss-media-queue'
import type { UseCases } from '../../main/container'

export interface WorkerOptions {
  concurrency: number
}

/**
 * Wires queue messages to use cases — the job-side equivalent of HTTP routes.
 * Handlers stay thin: decode the job, call a use case, log the outcome.
 */
export async function registerWorkers(
  boss: PgBoss,
  useCases: UseCases,
  logger: Logger,
  options: WorkerOptions,
): Promise<void> {
  await boss.work(
    QUEUES.processMedia,
    {
      includeMetadata: true,
      batchSize: 1,
      localConcurrency: options.concurrency,
      pollingIntervalSeconds: 1,
    },
    async ([job]: JobWithMetadata<ProcessMediaJob>[]) => {
      if (!job) return
      const { mediaId } = job.data
      const log = { jobId: job.id, mediaId, attempt: job.retryCount + 1 }
      try {
        const outcome = await useCases.processMedia.execute({ mediaId })
        logger.info({ ...log, outcome }, 'media processed')
      } catch (err) {
        const isFinalAttempt = job.retryCount >= job.retryLimit
        logger.error({ ...log, err, isFinalAttempt }, 'media processing attempt failed')
        if (isFinalAttempt) {
          await useCases.markProcessingFailed.execute({
            mediaId,
            reason: 'Processing failed after several attempts',
          })
        }
        throw err // let pg-boss record the failure / schedule the retry
      }
    },
  )

  await boss.work(QUEUES.expireStaleUploads, async () => {
    await useCases.expireStaleUploads.execute()
  })
  await boss.schedule(QUEUES.expireStaleUploads, '*/15 * * * *')

  await boss.work(QUEUES.purgeExpiredSessions, async () => {
    await useCases.purgeExpiredSessions.execute()
  })
  await boss.schedule(QUEUES.purgeExpiredSessions, '17 * * * *') // hourly
}
