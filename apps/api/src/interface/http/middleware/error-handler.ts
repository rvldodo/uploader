import type { ApiError, ErrorCode } from '@media-upload/contracts'
import type { ErrorHandler, NotFoundHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { DomainError, RateLimitedError } from '../../../domain/errors'
import type { AppEnv } from '../types'

const STATUS_BY_CODE: Record<ErrorCode, ContentfulStatusCode> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UPLOAD_VERIFICATION_FAILED: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
}

/** The single place where errors become HTTP responses. */
export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = c.get('requestId')

  if (err instanceof DomainError) {
    if (err instanceof RateLimitedError) c.header('Retry-After', String(err.retryAfterSeconds))
    return c.json(body(err.code, err.message, requestId, err.details), STATUS_BY_CODE[err.code])
  }

  if (err instanceof HTTPException && err.status < 500) {
    const code: ErrorCode = err.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'VALIDATION_FAILED'
    return c.json(body(code, err.message, requestId), err.status as ContentfulStatusCode)
  }

  c.get('logger').error({ err }, 'unhandled error')
  // Never leak internals (stack traces, SQL) to clients.
  return c.json(body('INTERNAL_ERROR', 'Something went wrong', requestId), 500)
}

export const notFoundHandler: NotFoundHandler<AppEnv> = (c) =>
  c.json(
    body('NOT_FOUND', `Route ${c.req.method} ${c.req.path} not found`, c.get('requestId')),
    404,
  )

function body(code: ErrorCode, message: string, requestId: string, details?: unknown): ApiError {
  return { error: { code, message, requestId, ...(details === undefined ? {} : { details }) } }
}
