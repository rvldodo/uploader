import { getConnInfo } from '@hono/node-server/conninfo'
import type { MiddlewareHandler } from 'hono'
import { UnauthenticatedError } from '../../../domain/errors'
import type { UseCases } from '../../../main/container'
import type { AppEnv, AuthedEnv } from '../types'

/**
 * Resolves `Authorization: Bearer <token>` into a viewer. Never rejects: an
 * absent or invalid token simply means "anonymous", so public content keeps
 * working with a stale cookie. Protected routes add `requireAuth`.
 */
export const authenticate =
  (useCases: UseCases): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    c.set('viewer', null)
    c.set('user', null)
    c.set('sessionToken', null)

    const header = c.req.header('authorization')
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null
    if (token) {
      try {
        const user = await useCases.authenticateSession.execute(token)
        c.set('viewer', { userId: user.id })
        c.set('user', user)
        c.set('sessionToken', token)
      } catch (err) {
        if (!(err instanceof UnauthenticatedError)) throw err
      }
    }
    await next()
  }

export const requireAuth: MiddlewareHandler<AuthedEnv> = async (c, next) => {
  if (!c.get('viewer')) throw new UnauthenticatedError('Authentication required')
  await next()
}

/**
 * Client IP for rate limiting. Behind a trusted proxy (the web BFF) we take
 * the first X-Forwarded-For hop; otherwise the socket address.
 */
export const clientIp =
  (trustProxy: boolean): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const forwarded = trustProxy
      ? c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      : undefined
    let ip = forwarded
    if (!ip) {
      try {
        ip = getConnInfo(c).remote.address
      } catch {
        // No socket (e.g. app.request() in tests).
      }
    }
    c.set('clientIp', ip || 'unknown')
    await next()
  }
