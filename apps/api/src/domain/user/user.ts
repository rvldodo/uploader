import { ValidationError } from '../errors'

export interface UserSnapshot {
  id: string
  /** Stored trimmed and lower-cased; unique. */
  email: string
  name: string
  passwordHash: string
  createdAt: Date
  updatedAt: Date
}

export class User {
  private constructor(private readonly state: UserSnapshot) {}

  static create(input: {
    id: string
    email: string
    name: string
    passwordHash: string
    now: Date
  }): User {
    const email = normalizeEmail(input.email)
    const name = input.name.trim().slice(0, 80)
    if (!/^[^\s@]+@[^\s@]+$/.test(email)) throw new ValidationError('Invalid email address')
    if (!name) throw new ValidationError('Name is required')
    return new User({
      id: input.id,
      email,
      name,
      passwordHash: input.passwordHash,
      createdAt: input.now,
      updatedAt: input.now,
    })
  }

  static restore(snapshot: UserSnapshot): User {
    return new User({ ...snapshot })
  }

  get id() {
    return this.state.id
  }
  get email() {
    return this.state.email
  }
  get name() {
    return this.state.name
  }
  get passwordHash() {
    return this.state.passwordHash
  }

  toSnapshot(): UserSnapshot {
    return { ...this.state }
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
