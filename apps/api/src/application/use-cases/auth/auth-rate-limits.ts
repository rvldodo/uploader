import { RateLimitedError } from '../../../domain/errors'
import type { RateLimiter } from '../../ports/security'

/**
 * Brute-force protection for credential endpoints. Limits are per account
 * (stops targeted guessing) and per client IP (stops credential stuffing).
 */
export const AUTH_LIMITS = {
  loginPerEmail: { limit: 10, windowSeconds: 15 * 60 },
  loginPerIp: { limit: 50, windowSeconds: 15 * 60 },
  registerPerIp: { limit: 10, windowSeconds: 60 * 60 },
} as const

export async function enforceRateLimit(
  limiter: RateLimiter,
  key: string,
  rule: { limit: number; windowSeconds: number },
): Promise<void> {
  const result = await limiter.consume(key, rule.limit, rule.windowSeconds)
  if (!result.allowed) {
    throw new RateLimitedError(
      'Too many attempts, please try again later',
      result.retryAfterSeconds,
    )
  }
}
