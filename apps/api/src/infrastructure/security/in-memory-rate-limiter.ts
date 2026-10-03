import type { RateLimiter, RateLimitResult } from '../../application/ports/security'
import type { Clock } from '../../application/ports/system'

/**
 * Fixed-window counter kept in process memory.
 *
 * Good enough for a single API instance. With several replicas each keeps
 * its own counters (effective limit = limit × replicas); swap in a
 * Redis/Postgres-backed adapter behind the same port when scaling out.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>()
  private lastSweep = 0

  constructor(private readonly clock: Clock) {}

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = this.clock.now().getTime()
    this.sweep(now)

    let window = this.windows.get(key)
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + windowSeconds * 1000 }
      this.windows.set(key, window)
    }
    window.count++

    const allowed = window.count <= limit
    return { allowed, retryAfterSeconds: allowed ? 0 : Math.ceil((window.resetAt - now) / 1000) }
  }

  /** Drops expired windows at most once a minute so memory stays bounded. */
  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) return
    this.lastSweep = now
    for (const [key, w] of this.windows) if (w.resetAt <= now) this.windows.delete(key)
  }
}
