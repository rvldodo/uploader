import type { AuthSessionResponse, LoginRequest } from '@media-upload/contracts'
import { UnauthenticatedError } from '../../../domain/errors'
import { normalizeEmail } from '../../../domain/user/user'
import type { PasswordHasher, RateLimiter } from '../../ports/security'
import type { UserRepository } from '../../ports/user-repository'
import { AUTH_LIMITS, enforceRateLimit } from './auth-rate-limits'
import type { SessionIssuer } from './session-issuer'

export class LoginUser {
  /** Lazily computed hash used to equalize timing for unknown emails. */
  private dummyHash: Promise<string> | null = null

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionIssuer,
    private readonly limiter: RateLimiter,
  ) {}

  async execute(input: LoginRequest & { clientIp: string }): Promise<AuthSessionResponse> {
    const email = normalizeEmail(input.email)
    await enforceRateLimit(this.limiter, `login:ip:${input.clientIp}`, AUTH_LIMITS.loginPerIp)
    await enforceRateLimit(this.limiter, `login:email:${email}`, AUTH_LIMITS.loginPerEmail)

    const user = await this.users.findByEmail(email)
    // Always run a hash verification so response time doesn't reveal whether the email exists.
    this.dummyHash ??= this.hasher.hash('timing-equalizer')
    const valid = await this.hasher.verify(
      input.password,
      user?.passwordHash ?? (await this.dummyHash),
    )

    // One generic message for both cases: don't confirm which emails have accounts.
    if (!user || !valid) throw new UnauthenticatedError('Invalid email or password')
    return this.sessions.issue(user)
  }
}
