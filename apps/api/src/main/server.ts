import { HeadBucketCommand } from '@aws-sdk/client-s3'
import { serve } from '@hono/node-server'
import { sql } from 'drizzle-orm'
import { loadEnv } from '../config/env'
import { createLogger } from '../infrastructure/logger'
import { createHttpApp } from '../interface/http/app'
import { createContainer } from './container'
import { onShutdown } from './shutdown'

const env = loadEnv()
const logger = createLogger(env, 'api')
const container = await createContainer(env, logger, 'producer')

const app = createHttpApp({
  useCases: container.useCases,
  logger,
  trustProxy: env.TRUST_PROXY,
  readinessChecks: {
    database: async () => {
      await container.database.db.execute(sql`select 1`)
    },
    storage: async () => {
      await container.storage.rawClient.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }))
    },
  },
})

const server = serve({ fetch: app.fetch, hostname: env.HOST, port: env.PORT }, (info) => {
  logger.info({ port: info.port }, 'api listening')
})

onShutdown(logger, async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await container.shutdown()
})
