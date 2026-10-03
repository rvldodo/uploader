/**
 * A login session. Only a hash of the bearer token is persisted, so a
 * database leak does not hand out usable sessions.
 */
export interface Session {
  /** SHA-256 of the bearer token, hex encoded. */
  id: string
  userId: string
  expiresAt: Date
  createdAt: Date
}

export const isSessionExpired = (session: Session, now: Date) =>
  session.expiresAt.getTime() <= now.getTime()
