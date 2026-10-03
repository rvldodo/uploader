import type { Session } from '../../domain/user/session'

export interface SessionRepository {
  insert(session: Session): Promise<void>
  findById(id: string): Promise<Session | null>
  extend(id: string, expiresAt: Date): Promise<void>
  delete(id: string): Promise<void>
  /** Returns how many sessions were removed. */
  deleteExpired(now: Date): Promise<number>
}
