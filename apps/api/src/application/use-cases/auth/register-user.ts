import type { AuthSessionResponse, RegisterRequest } from '@media-upload/contracts'
import { ConflictError } from '../../../domain/errors'
import { normalizeEmail, User } from '../../../domain/user/user'
import type { PasswordHasher, RateLimiter } from '../../ports/security'
import type { Clock, IdGenerator } from '../../ports/system'
import type { UserRepository } from '../../ports/user-repository'
import { AUTH_LIMITS, enforceRateLimit } from './auth-rate-limits'
import type { SessionIssuer } from './session-issuer'

export class RegisterUser {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionIssuer,
    private readonly limiter: RateLimiter,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: RegisterRequest & { clientIp: string }): Promise<AuthSessionResponse> {
    await enforceRateLimit(this.limiter, `register:ip:${input.clientIp}`, AUTH_LIMITS.registerPerIp)

    const email = normalizeEmail(input.email)
    if (await this.users.findByEmail(email)) {
      throw new ConflictError('An account with this email already exists')
    }

    const user = User.create({
      id: this.ids.next(),
      email,
      name: input.name,
      passwordHash: await this.hasher.hash(input.password),
      now: this.clock.now(),
    })
    await this.users.insert(user) // unique index catches a concurrent duplicate
    return this.sessions.issue(user)
  }
}
