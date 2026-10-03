import { UnauthenticatedError } from '../../../domain/errors'
import { isSessionExpired } from '../../../domain/user/session'
import type { User } from '../../../domain/user/user'
import type { TokenGenerator } from '../../ports/security'
import type { SessionRepository } from '../../ports/session-repository'
import type { Clock } from '../../ports/system'
import type { UserRepository } from '../../ports/user-repository'

/**
 * Resolves a bearer token to a user. Sessions slide: once less than half the
 * lifetime remains, the expiry is pushed out, so active users stay signed in
 * while idle sessions die.
 */
export class AuthenticateSession {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly users: UserRepository,
    private readonly tokens: TokenGenerator,
    private readonly clock: Clock,
    private readonly ttlSeconds: number,
  ) {}

  async execute(token: string): Promise<User> {
    const now = this.clock.now()
    const session = await this.sessions.findById(this.tokens.hash(token))
    if (!session || isSessionExpired(session, now)) throw invalid()

    const user = await this.users.findById(session.userId)
    if (!user) throw invalid()

    const remainingMs = session.expiresAt.getTime() - now.getTime()
    if (remainingMs < (this.ttlSeconds * 1000) / 2) {
      await this.sessions.extend(session.id, new Date(now.getTime() + this.ttlSeconds * 1000))
    }
    return user
  }
}

const invalid = () => new UnauthenticatedError('Session is invalid or has expired')
