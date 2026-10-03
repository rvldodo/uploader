import type { MediaKind } from '../../domain/media/media'

export interface MediaAnalysis {
  width: number | null
  height: number | null
  durationMs: number | null
  /** WebP thumbnail bytes. */
  thumbnail: Buffer
}

/**
 * Inspects a local media file: extracts metadata and renders a thumbnail.
 * Must throw `UnprocessableMediaError` when the file content itself is bad
 * (corrupt, not actually a video, ...) so callers can fail fast instead of retrying.
 */
export interface MediaAnalyzer {
  analyze(kind: MediaKind, filePath: string): Promise<MediaAnalysis>
}

export class UnprocessableMediaError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'UnprocessableMediaError'
  }
}
