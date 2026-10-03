import { describe, expect, it } from 'vitest'
import { ConflictError, RateLimitedError, UnauthenticatedError } from '../src/domain/errors'
import { createTestHarness, SESSION_TTL_SECONDS } from './fakes/test-harness'

const creds = {
  email: 'Alice@Example.com ',
  password: 'correct horse battery',
  name: 'Alice',
  clientIp: '1.1.1.1',
}

describe('registration & login', () => {
  it('registers with a normalized email and returns a working session', async () => {
    const h = createTestHarness()
    const res = await h.useCases.registerUser.execute(creds)

    expect(res.user).toMatchObject({ email: 'alice@example.com', name: 'Alice' })
    const user = await h.useCases.authenticateSession.execute(res.token)
    expect(user.id).toBe(res.user.id)
  })

  it('stores only a hash of the token and of the password', async () => {
    const h = createTestHarness()
    const res = await h.useCases.registerUser.execute(creds)
    expect(h.sessions.rows.has(res.token)).toBe(false)
    expect([...h.users.rows.values()][0]?.passwordHash).not.toBe(creds.password)
  })

  it('rejects a duplicate email regardless of case', async () => {
    const h = createTestHarness()
    await h.useCases.registerUser.execute(creds)
    await expect(
      h.useCases.registerUser.execute({ ...creds, email: 'ALICE@example.com' }),
    ).rejects.toThrow(ConflictError)
  })

  it('logs in with the right password only, with one generic error', async () => {
    const h = createTestHarness()
    await h.useCases.registerUser.execute(creds)

    const ok = await h.useCases.loginUser.execute({ ...creds, email: 'alice@example.com' })
    expect(ok.token).toBeTruthy()

    const wrong = h.useCases.loginUser.execute({ ...creds, password: 'nope' })
    await expect(wrong).rejects.toThrow('Invalid email or password')
    const unknown = h.useCases.loginUser.execute({ ...creds, email: 'bob@example.com' })
    await expect(unknown).rejects.toThrow('Invalid email or password')
  })

  it('rate limits repeated login attempts per account', async () => {
    const h = createTestHarness()
    await h.useCases.registerUser.execute(creds)
    const attempt = () => h.useCases.loginUser.execute({ ...creds, password: 'bad' })

    for (let i = 0; i < 10; i++) await expect(attempt()).rejects.toThrow(UnauthenticatedError)
    await expect(attempt()).rejects.toThrow(RateLimitedError)

    h.clock.advance(15 * 60 * 1000)
    await expect(attempt()).rejects.toThrow(UnauthenticatedError)
  })
})

describe('sessions', () => {
  it('invalidates the session on logout', async () => {
    const h = createTestHarness()
    const { token } = await h.useCases.registerUser.execute(creds)
    await h.useCases.logoutUser.execute(token)
    await expect(h.useCases.authenticateSession.execute(token)).rejects.toThrow(
      UnauthenticatedError,
    )
  })

  it('expires idle sessions but slides active ones', async () => {
    const h = createTestHarness()
    const { token } = await h.useCases.registerUser.execute(creds)
    const day = 24 * 3600 * 1000

    // Active use past the halfway mark pushes the expiry out…
    h.clock.advance(20 * day)
    await h.useCases.authenticateSession.execute(token)
    h.clock.advance(20 * day)
    await expect(h.useCases.authenticateSession.execute(token)).resolves.toBeTruthy()

    // …but a session left idle for longer than the TTL dies.
    h.clock.advance(SESSION_TTL_SECONDS * 1000 + 1)
    await expect(h.useCases.authenticateSession.execute(token)).rejects.toThrow(
      UnauthenticatedError,
    )
    expect(await h.useCases.purgeExpiredSessions.execute()).toBe(1)
  })

  it('rejects unknown tokens', async () => {
    const h = createTestHarness()
    await expect(h.useCases.authenticateSession.execute('forged')).rejects.toThrow(
      UnauthenticatedError,
    )
  })
})
