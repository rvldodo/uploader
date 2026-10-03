import type { TokenGenerator } from '../../ports/security'
import type { SessionRepository } from '../../ports/session-repository'

export class LogoutUser {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly tokens: TokenGenerator,
  ) {}

  /** Idempotent: logging out an unknown or expired session is a no-op. */
  async execute(token: string): Promise<void> {
    await this.sessions.delete(this.tokens.hash(token))
  }
}
