export interface PasswordHasher {
  hash(password: string): Promise<string>
  /** Constant-time comparison. Returns false (never throws) on malformed hashes. */
  verify(password: string, hash: string): Promise<boolean>
}

export interface TokenGenerator {
  /** A new unguessable, URL-safe bearer token. */
  generate(): string
  /** Deterministic one-way hash used as the storage key for a token. */
  hash(token: string): string
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

export interface RateLimiter {
  /** Records one hit for `key`; denies once more than `limit` hits fall in the window. */
  consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>
}
