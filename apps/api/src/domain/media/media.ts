import {
  checkUploadPolicy,
  type MediaKind,
  type MediaStatus,
  type MediaVisibility,
  mediaKindFromMimeType,
} from '@media-upload/contracts'
import {
  InvalidStateError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  UploadVerificationError,
  ValidationError,
} from '../errors'
import { mediaStorageKeys } from './storage-keys'

export type { MediaKind, MediaStatus, MediaVisibility }

export interface MediaMetadata {
  width: number | null
  height: number | null
  durationMs: number | null
}

/** Plain, serialisable state of a Media aggregate. Used for persistence round-trips. */
export interface MediaSnapshot extends MediaMetadata {
  id: string
  ownerId: string
  kind: MediaKind
  status: MediaStatus
  visibility: MediaVisibility
  filename: string
  mimeType: string
  sizeBytes: number
  storageKey: string
  /** Multipart upload session id in object storage; null for single-PUT uploads or once finished. */
  multipartUploadId: string | null
  thumbnailKey: string | null
  failureReason: string | null
  /** Optimistic-concurrency token, incremented on every persisted change. */
  version: number
  createdAt: Date
  updatedAt: Date
}

export interface CreateMediaInput {
  id: string
  ownerId: string
  visibility?: MediaVisibility
  filename: string
  mimeType: string
  sizeBytes: number
  now: Date
}

/**
 * Media aggregate root.
 *
 * Owns the upload/processing lifecycle as an explicit state machine:
 *
 *   uploading ──complete──▶ processing ──▶ ready
 *       │                       │
 *       └──cancel/expire──▶ cancelled   └──▶ failed
 *
 * Every transition is a method that validates the current state, so illegal
 * transitions (e.g. completing a cancelled upload) are impossible to express.
 */
export class Media {
  private constructor(private state: MediaSnapshot) {}

  static create(input: CreateMediaInput): Media {
    const filename = sanitizeFilename(input.filename)
    if (!filename) throw new ValidationError('Filename is required')

    const violation = checkUploadPolicy(input)
    if (violation?.code === 'UNSUPPORTED_TYPE')
      throw new UnsupportedMediaTypeError(violation.message)
    if (violation?.code === 'FILE_TOO_LARGE') throw new PayloadTooLargeError(violation.message)
    if (violation) throw new ValidationError(violation.message)

    // checkUploadPolicy guarantees the kind resolves.
    const kind = mediaKindFromMimeType(input.mimeType) as MediaKind

    return new Media({
      id: input.id,
      ownerId: input.ownerId,
      kind,
      status: 'uploading',
      visibility: input.visibility ?? 'private',
      filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storageKey: mediaStorageKeys.original(input.id, filename),
      multipartUploadId: null,
      thumbnailKey: null,
      width: null,
      height: null,
      durationMs: null,
      failureReason: null,
      version: 0,
      createdAt: input.now,
      updatedAt: input.now,
    })
  }

  /** Rehydrates an aggregate from persistence. Performs no validation. */
  static restore(snapshot: MediaSnapshot): Media {
    return new Media({ ...snapshot })
  }

  get id() {
    return this.state.id
  }
  get ownerId() {
    return this.state.ownerId
  }
  get visibility() {
    return this.state.visibility
  }
  get kind() {
    return this.state.kind
  }
  get status() {
    return this.state.status
  }
  get storageKey() {
    return this.state.storageKey
  }
  get thumbnailKey() {
    return this.state.thumbnailKey
  }
  get multipartUploadId() {
    return this.state.multipartUploadId
  }
  get sizeBytes() {
    return this.state.sizeBytes
  }
  get mimeType() {
    return this.state.mimeType
  }
  get version() {
    return this.state.version
  }

  /** Guards operations that only make sense while bytes are still being uploaded. */
  ensureUploading(): void {
    this.assertStatus('uploading', 'complete the upload')
  }

  attachMultipartUpload(uploadId: string): void {
    this.assertStatus('uploading', 'attach a multipart upload')
    this.state.multipartUploadId = uploadId
  }

  /**
   * Confirms the bytes landed in storage and hands the media over to processing.
   * @param storedSizeBytes size reported by object storage, used to detect truncated uploads.
   */
  markUploaded(storedSizeBytes: number, now: Date): void {
    this.assertStatus('uploading', 'complete the upload')
    if (storedSizeBytes !== this.state.sizeBytes) {
      throw new UploadVerificationError(
        `Stored object is ${storedSizeBytes} bytes but ${this.state.sizeBytes} bytes were declared`,
      )
    }
    this.state.status = 'processing'
    this.state.multipartUploadId = null
    this.touch(now)
  }

  markReady(metadata: MediaMetadata & { thumbnailKey: string }, now: Date): void {
    this.assertStatus('processing', 'mark as ready')
    this.state.status = 'ready'
    this.state.width = metadata.width
    this.state.height = metadata.height
    this.state.durationMs = metadata.durationMs
    this.state.thumbnailKey = metadata.thumbnailKey
    this.state.failureReason = null
    this.touch(now)
  }

  markFailed(reason: string, now: Date): void {
    this.assertStatus('processing', 'mark as failed')
    this.state.status = 'failed'
    this.state.failureReason = reason.slice(0, 500)
    this.touch(now)
  }

  cancel(reason: string, now: Date): void {
    this.assertStatus('uploading', 'cancel')
    this.state.status = 'cancelled'
    this.state.multipartUploadId = null
    this.state.failureReason = reason
    this.touch(now)
  }

  isOwnedBy(userId: string | null): boolean {
    return userId !== null && this.state.ownerId === userId
  }

  changeVisibility(visibility: MediaVisibility, now: Date): void {
    if (this.state.status === 'cancelled') {
      throw new InvalidStateError('Cannot change the visibility of a cancelled upload')
    }
    if (this.state.visibility === visibility) return
    this.state.visibility = visibility
    this.touch(now)
  }

  /** Called by the repository after a successful write. */
  markPersisted(): void {
    this.state.version += 1
  }

  toSnapshot(): MediaSnapshot {
    return { ...this.state }
  }

  private assertStatus(expected: MediaStatus, action: string): void {
    if (this.state.status !== expected) {
      throw new InvalidStateError(
        `Cannot ${action}: media is "${this.state.status}", expected "${expected}"`,
      )
    }
  }

  private touch(now: Date): void {
    this.state.updatedAt = now
  }
}

/** Strips path segments and control characters; keeps the name human readable. */
function sanitizeFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? ''
  return (
    base
      // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control chars is the point
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim()
      .slice(0, 255)
  )
}
