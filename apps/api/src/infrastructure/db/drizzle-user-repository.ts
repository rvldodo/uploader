import { eq, inArray } from 'drizzle-orm'
import type { UserRepository } from '../../application/ports/user-repository'
import { ConflictError } from '../../domain/errors'
import { User } from '../../domain/user/user'
import type { Database } from './client'
import { isUniqueViolation } from './pg-errors'
import { usersTable } from './schema'

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<User | null> {
    const [row] = await this.db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1)
    return row ? User.restore(row) : null
  }

  async findByIds(ids: readonly string[]): Promise<User[]> {
    if (ids.length === 0) return []
    const rows = await this.db
      .select()
      .from(usersTable)
      .where(inArray(usersTable.id, [...ids]))
    return rows.map((r) => User.restore(r))
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1)
    return row ? User.restore(row) : null
  }

  async insert(user: User): Promise<void> {
    try {
      await this.db.insert(usersTable).values(user.toSnapshot())
    } catch (err) {
      if (isUniqueViolation(err))
        throw new ConflictError('An account with this email already exists')
      throw err
    }
  }
}
