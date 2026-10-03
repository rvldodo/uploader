import type { User } from '../../domain/user/user'

export interface UserRepository {
  findById(id: string): Promise<User | null>
  findByIds(ids: readonly string[]): Promise<User[]>
  /** `email` must already be normalized. */
  findByEmail(email: string): Promise<User | null>
  /** @throws ConflictError if the email is already registered. */
  insert(user: User): Promise<void>
}
