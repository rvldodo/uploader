import type {
  CompletedPart,
  InitiateUploadRequest,
  InitiateUploadResponse,
  MediaDto,
} from '@media-upload/contracts'

/**
 * The minimal file abstraction the engine needs. A browser `File` satisfies it
 * as-is; React Native adapts a picked asset (see apps/mobile).
 */
export interface UploadSource {
  readonly name: string
  readonly size: number
  /** MIME type. */
  readonly type: string
  slice(start: number, end: number): Blob
}

/** Control-plane calls (go through our server). */
export interface UploadGateway {
  initiate(input: InitiateUploadRequest): Promise<InitiateUploadResponse>
  complete(input: { mediaId: string; parts?: CompletedPart[] }): Promise<MediaDto>
  cancel(mediaId: string): Promise<void>
}

/** Data-plane calls (bytes go straight to object storage via signed URLs). */
export interface BlobTransport {
  put(
    url: string,
    body: Blob,
    options: {
      contentType?: string
      signal: AbortSignal
      onProgress: (loadedBytes: number) => void
    },
  ): Promise<{ etag: string | null }>
}

export class TransportError extends Error {
  constructor(
    message: string,
    /** HTTP status, or 0 for network failures. */
    readonly status: number,
  ) {
    super(message)
    this.name = 'TransportError'
  }

  get retryable(): boolean {
    return this.status === 0 || this.status === 408 || this.status === 429 || this.status >= 500
  }
}

export type UploadStatus =
  | 'queued'
  | 'uploading'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'cancelled'

/** Immutable view of one upload, safe to hand to React. */
export interface UploadSnapshot {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  status: UploadStatus
  uploadedBytes: number
  /** Smoothed throughput, for ETA display. */
  bytesPerSecond: number
  error: string | null
  mediaId: string | null
}
