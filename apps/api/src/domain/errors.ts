/**
 * Base class for errors that represent a broken business rule.
 *
 * Domain and application code throws these; the interface layer (HTTP, jobs)
 * is the only place that knows how to translate them into transport concerns
 * such as status codes. Anything that is *not* a DomainError is treated as an
 * unexpected failure.
 */
export abstract class DomainError extends Error {
  abstract readonly code:
    | 'VALIDATION_FAILED'
    | 'UNAUTHENTICATED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'UNSUPPORTED_MEDIA_TYPE'
    | 'PAYLOAD_TOO_LARGE'
    | 'UPLOAD_VERIFICATION_FAILED'
    | 'RATE_LIMITED'

  constructor(
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = new.target.name
  }
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_FAILED'
}

/** No valid credentials were presented. */
export class UnauthenticatedError extends DomainError {
  readonly code = 'UNAUTHENTICATED'
}

/** Credentials are valid but the actor may not perform this action. */
export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN'
}

export class RateLimitedError extends DomainError {
  readonly code = 'RATE_LIMITED'
  constructor(
    message: string,
    readonly retryAfterSeconds: number,
  ) {
    super(message)
  }
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND'
}

/** The request conflicts with existing data (e.g. a duplicate email). */
export class ConflictError extends DomainError {
  readonly code = 'CONFLICT'
}

/** The aggregate is not in a state that allows the requested operation. */
export class InvalidStateError extends DomainError {
  readonly code = 'CONFLICT'
}

/** Someone else modified the aggregate between our read and our write. */
export class ConcurrencyError extends DomainError {
  readonly code = 'CONFLICT'
}

export class UnsupportedMediaTypeError extends DomainError {
  readonly code = 'UNSUPPORTED_MEDIA_TYPE'
}

export class PayloadTooLargeError extends DomainError {
  readonly code = 'PAYLOAD_TOO_LARGE'
}

/** The bytes in storage do not match what the client declared. */
export class UploadVerificationError extends DomainError {
  readonly code = 'UPLOAD_VERIFICATION_FAILED'
}
