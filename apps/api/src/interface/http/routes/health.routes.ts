import { Hono } from 'hono'
import type { AppEnv } from '../types'

export type ReadinessCheck = () => Promise<void>

/**
 * - /healthz: liveness — the process is up. Never touches dependencies, so a
 *   database blip doesn't make the orchestrator kill healthy pods.
 * - /readyz: readiness — dependencies are reachable; safe to route traffic.
 */
export function healthRoutes(checks: Record<string, ReadinessCheck>) {
  return new Hono<AppEnv>()
    .get('/healthz', (c) => c.json({ status: 'ok' }))
    .get('/readyz', async (c) => {
      const results = await Promise.all(
        Object.entries(checks).map(async ([name, check]) => {
          try {
            await check()
            return [name, 'ok'] as const
          } catch (err) {
            c.get('logger').warn({ err, check: name }, 'readiness check failed')
            return [name, 'failing'] as const
          }
        }),
      )
      const ready = results.every(([, status]) => status === 'ok')
      return c.json(
        { status: ready ? 'ok' : 'degraded', checks: Object.fromEntries(results) },
        ready ? 200 : 503,
      )
    })
}
