import type { SessionRepository } from '../../ports/session-repository'
import type { Clock, Logger } from '../../ports/system'

/** Periodic housekeeping: expired sessions are useless, so don't keep them around. */
export class PurgeExpiredSessions {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {}

  async execute(): Promise<number> {
    const purged = await this.sessions.deleteExpired(this.clock.now())
    if (purged > 0) this.logger.info({ purged }, 'purged expired sessions')
    return purged
  }
}
