import { randomBytes, type ScryptOptions, scrypt, timingSafeEqual } from 'node:crypto'
import type { PasswordHasher } from '../../application/ports/security'

const scryptAsync = (password: string, salt: Buffer, keylen: number, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  )

/**
 * scrypt (memory-hard KDF, built into Node: no native dependency).
 * Parameters are encoded in the hash, so they can be raised later without
 * invalidating existing passwords:  scrypt$N$r$p$<salt b64>$<key b64>
 */
export class ScryptPasswordHasher implements PasswordHasher {
  constructor(
    private readonly params = { N: 2 ** 15, r: 8, p: 1 },
    private readonly keyLength = 64,
  ) {}

  async hash(password: string): Promise<string> {
    const salt = randomBytes(16)
    const { N, r, p } = this.params
    const key = await scryptAsync(password, salt, this.keyLength, {
      N,
      r,
      p,
      maxmem: 128 * N * r * 2,
    })
    return ['scrypt', N, r, p, salt.toString('base64'), key.toString('base64')].join('$')
  }

  async verify(password: string, encoded: string): Promise<boolean> {
    const [algo, n, r, p, saltB64, keyB64] = encoded.split('$')
    if (algo !== 'scrypt' || !saltB64 || !keyB64) return false
    const N = Number(n)
    const R = Number(r)
    const expected = Buffer.from(keyB64, 'base64')
    try {
      const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length, {
        N,
        r: R,
        p: Number(p),
        maxmem: 128 * N * R * 2,
      })
      return actual.length === expected.length && timingSafeEqual(actual, expected)
    } catch {
      return false
    }
  }
}
