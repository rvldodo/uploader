import type { AuthSessionResponse } from '@media-upload/contracts'
import type { User } from '../../../domain/user/user'
import type { TokenGenerator } from '../../ports/security'
import type { SessionRepository } from '../../ports/session-repository'
import type { Clock } from '../../ports/system'

/** Creates a session for a user and returns the one-time-visible bearer token. */
export class SessionIssuer {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly tokens: TokenGenerator,
    private readonly clock: Clock,
    private readonly ttlSeconds: number,
  ) {}

  async issue(user: User): Promise<AuthSessionResponse> {
    const now = this.clock.now()
    const token = this.tokens.generate()
    const expiresAt = new Date(now.getTime() + this.ttlSeconds * 1000)
    await this.sessions.insert({
      id: this.tokens.hash(token),
      userId: user.id,
      expiresAt,
      createdAt: now,
    })
    return { user: toUserDto(user), token, expiresAt: expiresAt.toISOString() }
  }
}

export const toUserDto = (user: User) => ({ id: user.id, email: user.email, name: user.name })
