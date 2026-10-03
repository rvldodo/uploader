/**
 * Upload policy shared by client and server.
 *
 * The client uses it for instant feedback (reject a 10 GB file before any
 * network call); the server enforces it as the source of truth. Keep both
 * sides in sync by importing from here — never duplicate these values.
 */

export const MEDIA_KINDS = ['image', 'video'] as const
export type MediaKind = (typeof MEDIA_KINDS)[number]

export const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
  video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'],
} as const satisfies Record<MediaKind, readonly string[]>

const MiB = 1024 * 1024
const GiB = 1024 * MiB

export const MAX_SIZE_BYTES: Record<MediaKind, number> = {
  image: 50 * MiB,
  video: 5 * GiB,
}

/** Resolves the media kind for a MIME type, or `null` if it is not accepted. */
export function mediaKindFromMimeType(mimeType: string): MediaKind | null {
  for (const kind of MEDIA_KINDS) {
    if ((ALLOWED_MIME_TYPES[kind] as readonly string[]).includes(mimeType)) return kind
  }
  return null
}

export type PolicyViolation =
  | { code: 'UNSUPPORTED_TYPE'; message: string }
  | { code: 'FILE_TOO_LARGE'; message: string }
  | { code: 'EMPTY_FILE'; message: string }

/** Checks a file against the policy. Returns `null` when the file is acceptable. */
export function checkUploadPolicy(file: {
  mimeType: string
  sizeBytes: number
}): PolicyViolation | null {
  const kind = mediaKindFromMimeType(file.mimeType)
  if (!kind) {
    return {
      code: 'UNSUPPORTED_TYPE',
      message: `File type "${file.mimeType || 'unknown'}" is not supported`,
    }
  }
  if (file.sizeBytes <= 0) {
    return { code: 'EMPTY_FILE', message: 'File is empty' }
  }
  if (file.sizeBytes > MAX_SIZE_BYTES[kind]) {
    return {
      code: 'FILE_TOO_LARGE',
      message: `${kind === 'image' ? 'Images' : 'Videos'} must be at most ${formatBytes(MAX_SIZE_BYTES[kind])}`,
    }
  }
  return null
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`
}
