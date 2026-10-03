export interface Clock {
  now(): Date
}

export interface IdGenerator {
  next(): string
}

/** Minimal structured-logger port (pino-compatible). */
export interface Logger {
  info(obj: object, msg?: string): void
  warn(obj: object, msg?: string): void
  error(obj: object, msg?: string): void
}
