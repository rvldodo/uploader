import { createHash, randomBytes } from 'node:crypto'
import type { TokenGenerator } from '../../application/ports/security'

/** 256-bit random tokens; stored as SHA-256 (fast hashing is fine for high-entropy secrets). */
export class CryptoTokenGenerator implements TokenGenerator {
  generate(): string {
    return randomBytes(32).toString('base64url')
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }
}
