import { eq, lte } from 'drizzle-orm'
import type { SessionRepository } from '../../application/ports/session-repository'
import type { Session } from '../../domain/user/session'
import type { Database } from './client'
import { sessionsTable } from './schema'

export class DrizzleSessionRepository implements SessionRepository {
  constructor(private readonly db: Database) {}

  async insert(session: Session): Promise<void> {
    await this.db.insert(sessionsTable).values(session)
  }

  async findById(id: string): Promise<Session | null> {
    const [row] = await this.db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, id))
      .limit(1)
    return row ?? null
  }

  async extend(id: string, expiresAt: Date): Promise<void> {
    await this.db.update(sessionsTable).set({ expiresAt }).where(eq(sessionsTable.id, id))
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(sessionsTable).where(eq(sessionsTable.id, id))
  }

  async deleteExpired(now: Date): Promise<number> {
    const deleted = await this.db
      .delete(sessionsTable)
      .where(lte(sessionsTable.expiresAt, now))
      .returning({ id: sessionsTable.id })
    return deleted.length
  }
}
