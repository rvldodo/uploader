import { loadEnv } from '../config/env'
import { createLogger } from '../infrastructure/logger'
import { registerWorkers } from '../interface/jobs/register-workers'
import { createContainer } from './container'
import { onShutdown } from './shutdown'

const env = loadEnv()
const logger = createLogger(env, 'worker')
const container = await createContainer(env, logger, 'worker')

await registerWorkers(container.boss, container.useCases, logger, {
  concurrency: env.WORKER_CONCURRENCY,
})
logger.info({ concurrency: env.WORKER_CONCURRENCY }, 'worker started')

onShutdown(logger, () => container.shutdown())
