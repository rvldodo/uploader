import type {
  MediaShare,
  MediaShareRepository,
} from '../../src/application/ports/media-share-repository'
import type { PasswordHasher, TokenGenerator } from '../../src/application/ports/security'
import type { SessionRepository } from '../../src/application/ports/session-repository'
import type { UserRepository } from '../../src/application/ports/user-repository'
import { ConflictError } from '../../src/domain/errors'
import type { Session } from '../../src/domain/user/session'
import { User, type UserSnapshot } from '../../src/domain/user/user'

export class InMemoryUserRepository implements UserRepository {
  readonly rows = new Map<string, UserSnapshot>()

  async findById(id: string) {
    const row = this.rows.get(id)
    return row ? User.restore(row) : null
  }
  async findByIds(ids: readonly string[]) {
    return ids.flatMap((id) => {
      const row = this.rows.get(id)
      return row ? [User.restore(row)] : []
    })
  }
  async findByEmail(email: string) {
    const row = [...this.rows.values()].find((u) => u.email === email)
    return row ? User.restore(row) : null
  }
  async insert(user: User) {
    if (await this.findByEmail(user.email)) throw new ConflictError('duplicate email')
    this.rows.set(user.id, user.toSnapshot())
  }
}

export class InMemorySessionRepository implements SessionRepository {
  readonly rows = new Map<string, Session>()

  async insert(s: Session) {
    this.rows.set(s.id, { ...s })
  }
  async findById(id: string) {
    return this.rows.get(id) ?? null
  }
  async extend(id: string, expiresAt: Date) {
    const s = this.rows.get(id)
    if (s) s.expiresAt = expiresAt
  }
  async delete(id: string) {
    this.rows.delete(id)
  }
  async deleteExpired(now: Date) {
    let n = 0
    for (const [id, s] of this.rows) {
      if (s.expiresAt <= now) {
        this.rows.delete(id)
        n++
      }
    }
    return n
  }
}

export class InMemoryMediaShareRepository implements MediaShareRepository {
  readonly rows: MediaShare[] = []

  async add(share: MediaShare) {
    if (!(await this.exists(share.mediaId, share.userId))) this.rows.push({ ...share })
  }
  async remove(mediaId: string, userId: string) {
    const i = this.rows.findIndex((s) => s.mediaId === mediaId && s.userId === userId)
    if (i >= 0) this.rows.splice(i, 1)
  }
  async exists(mediaId: string, userId: string) {
    return this.rows.some((s) => s.mediaId === mediaId && s.userId === userId)
  }
  async listForMedia(mediaId: string) {
    return this.rows.filter((s) => s.mediaId === mediaId)
  }
  /** Mirrors the FK cascade. */
  removeForMedia(mediaId: string) {
    for (let i = this.rows.length - 1; i >= 0; i--)
      if (this.rows[i]?.mediaId === mediaId) this.rows.splice(i, 1)
  }
}

/** Not a real KDF: tests only care that hash/verify round-trip. */
export const fakeHasher: PasswordHasher = {
  hash: async (p) => `hashed:${p}`,
  verify: async (p, h) => h === `hashed:${p}`,
}

export function fakeTokens(): TokenGenerator {
  let n = 0
  return { generate: () => `token-${++n}`, hash: (t) => `sha:${t}` }
}
