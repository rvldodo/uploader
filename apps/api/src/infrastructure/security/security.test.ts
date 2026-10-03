import { describe, expect, it } from 'vitest'
import { CryptoTokenGenerator } from './crypto-token-generator'
import { ScryptPasswordHasher } from './scrypt-password-hasher'

describe('ScryptPasswordHasher', () => {
  // Low cost factor keeps the test fast; production uses N = 2^15.
  const hasher = new ScryptPasswordHasher({ N: 2 ** 10, r: 8, p: 1 })

  it('verifies the right password and rejects the wrong one', async () => {
    const hash = await hasher.hash('correct horse battery')
    expect(hash).toMatch(/^scrypt\$1024\$8\$1\$/)
    expect(await hasher.verify('correct horse battery', hash)).toBe(true)
    expect(await hasher.verify('Correct horse battery', hash)).toBe(false)
  })

  it('salts every hash', async () => {
    expect(await hasher.hash('same')).not.toBe(await hasher.hash('same'))
  })

  it('returns false for malformed hashes instead of throwing', async () => {
    expect(await hasher.verify('x', 'not-a-hash')).toBe(false)
    expect(await hasher.verify('x', 'scrypt$abc$8$1$AAAA$AAAA')).toBe(false)
  })

  it('verifies hashes made with different parameters (upgradable cost)', async () => {
    const hash = await new ScryptPasswordHasher({ N: 2 ** 11, r: 8, p: 1 }).hash('pw')
    expect(await hasher.verify('pw', hash)).toBe(true)
  })
})

describe('CryptoTokenGenerator', () => {
  const tokens = new CryptoTokenGenerator()

  it('generates unique url-safe tokens with a stable hash', () => {
    const a = tokens.generate()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(tokens.generate()).not.toBe(a)
    expect(tokens.hash(a)).toBe(tokens.hash(a))
    expect(tokens.hash(a)).toHaveLength(64)
  })
})
