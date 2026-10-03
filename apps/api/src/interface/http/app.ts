import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import type { AppLogger } from '../../infrastructure/logger'
import type { UseCases } from '../../main/container'
import { authenticate, clientIp } from './middleware/auth'
import { errorHandler, notFoundHandler } from './middleware/error-handler'
import { requestLogger } from './middleware/request-logger'
import { authRoutes } from './routes/auth.routes'
import { healthRoutes, type ReadinessCheck } from './routes/health.routes'
import { mediaRoutes } from './routes/media.routes'
import { uploadsRoutes } from './routes/uploads.routes'
import type { AppEnv } from './types'

export interface HttpAppDeps {
  useCases: UseCases
  logger: AppLogger
  readinessChecks: Record<string, ReadinessCheck>
  /** See TRUST_PROXY in config/env.ts. */
  trustProxy?: boolean
}

/**
 * Builds the HTTP application. Pure function of its dependencies, so tests can
 * call `app.request(...)` against fakes without opening a socket.
 */
export function createHttpApp({
  useCases,
  logger,
  readinessChecks,
  trustProxy = false,
}: HttpAppDeps) {
  return (
    new Hono<AppEnv>()
      .use(requestId())
      .use(requestLogger(logger))
      .use(secureHeaders())
      // File bytes never pass through the API (they go straight to storage),
      // so request bodies are small JSON documents.
      .use(bodyLimit({ maxSize: 1024 * 1024 }))
      .use(clientIp(trustProxy))
      .use(authenticate(useCases))
      .route('/', healthRoutes(readinessChecks))
      .route('/v1/auth', authRoutes(useCases))
      .route('/v1/uploads', uploadsRoutes(useCases))
      .route('/v1/media', mediaRoutes(useCases))
      .notFound(notFoundHandler)
      .onError(errorHandler)
  )
}

export type HttpApp = ReturnType<typeof createHttpApp>
