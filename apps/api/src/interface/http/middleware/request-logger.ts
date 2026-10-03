import type { MiddlewareHandler } from 'hono'
import type { AppLogger } from '../../../infrastructure/logger'
import type { AppEnv } from '../types'

/** Attaches a request-scoped child logger and logs one line per request. */
export const requestLogger =
  (logger: AppLogger): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const start = performance.now()
    const log = logger.child({ requestId: c.get('requestId') })
    c.set('logger', log)

    await next()

    const level = c.res.status >= 500 ? 'error' : c.res.status >= 400 ? 'warn' : 'info'
    log[level](
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: Math.round(performance.now() - start),
      },
      'request completed',
    )
  }
