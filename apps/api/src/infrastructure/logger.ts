import { pino } from 'pino'
import type { Env } from '../config/env'

export type AppLogger = pino.Logger

export function createLogger(env: Pick<Env, 'LOG_LEVEL' | 'NODE_ENV'>, name: string): AppLogger {
  return pino({
    name,
    level: env.LOG_LEVEL,
    redact: ['req.headers.authorization', 'req.headers.cookie'],
    // Human-friendly logs locally, JSON lines everywhere else (for log shippers).
    transport:
      env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
        : undefined,
  })
}
