import { ValidationError } from '../domain/errors'
import type { MediaCursor } from './ports/media-repository'

/**
 * Cursors are opaque to clients (base64url JSON) so the pagination strategy can
 * change without breaking the API contract.
 */
export function encodeCursor(cursor: MediaCursor): string {
  return Buffer.from(JSON.stringify([cursor.createdAt.toISOString(), cursor.id])).toString(
    'base64url',
  )
}

export function decodeCursor(raw: string): MediaCursor {
  try {
    const [createdAt, id] = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    const date = new Date(createdAt)
    if (typeof id !== 'string' || Number.isNaN(date.getTime())) throw new Error('bad cursor')
    return { createdAt: date, id }
  } catch {
    throw new ValidationError('Invalid pagination cursor')
  }
}
