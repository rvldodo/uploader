import type { CompletedPart, MediaVisibility, UploadInstructions } from '@media-upload/contracts'
import { abortError, isAbortError, mapWithConcurrency, withRetry } from './async'
import {
  type BlobTransport,
  TransportError,
  type UploadGateway,
  type UploadSnapshot,
  type UploadSource,
  type UploadStatus,
} from './types'

export interface UploadTaskOptions {
  /** Parallel part uploads per file. */
  partConcurrency: number
  /** Retries per part (network errors / 5xx only). */
  partRetries: number
  retryBaseDelayMs: number
}

export const defaultTaskOptions: UploadTaskOptions = {
  partConcurrency: 4,
  partRetries: 3,
  retryBaseDelayMs: 500,
}

/**
 * Uploads one file: initiate → PUT bytes to storage → complete.
 *
 * Owns its own progress accounting and cancellation. Knows nothing about
 * React; consumers observe it through `onChange` + `getSnapshot()`.
 */
export class UploadTask {
  private snapshot: UploadSnapshot
  private readonly controller = new AbortController()
  private readonly partProgress = new Map<number, number>()
  private throughputSample = { at: 0, bytes: 0 }

  constructor(
    readonly id: string,
    readonly file: UploadSource,
    private readonly gateway: UploadGateway,
    private readonly transport: BlobTransport,
    private readonly onChange: () => void,
    private readonly options: UploadTaskOptions = defaultTaskOptions,
    readonly visibility: MediaVisibility = 'private',
  ) {
    this.snapshot = {
      id,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      status: 'queued',
      uploadedBytes: 0,
      bytesPerSecond: 0,
      error: null,
      mediaId: null,
    }
  }

  getSnapshot(): UploadSnapshot {
    return this.snapshot
  }

  /** Marks a task as failed before it ever starts (e.g. client-side policy violation). */
  reject(reason: string): void {
    this.update({ status: 'failed', error: reason })
  }

  async run(): Promise<void> {
    if (this.snapshot.status !== 'queued') return
    const signal = this.controller.signal

    try {
      this.update({ status: 'uploading' })
      this.throughputSample = { at: performance.now(), bytes: 0 }

      const init = await this.gateway.initiate({
        filename: this.file.name,
        mimeType: this.file.type,
        sizeBytes: this.file.size,
        visibility: this.visibility,
      })
      this.update({ mediaId: init.mediaId })
      if (signal.aborted) throw abortError()

      const parts = await this.sendBytes(init.instructions, signal)

      this.update({ status: 'finalizing', uploadedBytes: this.file.size })
      await this.gateway.complete({ mediaId: init.mediaId, parts })
      this.update({ status: 'completed' })
    } catch (err) {
      const cancelled = isAbortError(err) || signal.aborted
      this.controller.abort() // stop sibling parts still in flight
      this.update(
        cancelled ? { status: 'cancelled' } : { status: 'failed', error: describeError(err) },
      )
      await this.releaseServerSide()
    }
  }

  cancel(): void {
    // Once finalizing, the server is already assembling the file; let it finish.
    if (isTerminal(this.snapshot.status) || this.snapshot.status === 'finalizing') return
    if (this.snapshot.status === 'queued') {
      this.update({ status: 'cancelled' })
      return
    }
    this.controller.abort()
  }

  private async sendBytes(
    instructions: UploadInstructions,
    signal: AbortSignal,
  ): Promise<CompletedPart[] | undefined> {
    if (instructions.strategy === 'single') {
      const whole = this.file.slice(0, this.file.size)
      await this.putWithRetry(instructions.url, whole, 1, signal, this.file.type)
      return undefined
    }

    const { partSize, parts } = instructions
    return mapWithConcurrency(parts, this.options.partConcurrency, async ({ partNumber, url }) => {
      const start = (partNumber - 1) * partSize
      const blob = this.file.slice(start, Math.min(start + partSize, this.file.size))
      const etag = await this.putWithRetry(url, blob, partNumber, signal)
      if (!etag) {
        throw new Error('Storage did not expose the ETag header; check the bucket CORS settings')
      }
      return { partNumber, etag }
    })
  }

  private putWithRetry(
    url: string,
    body: Blob,
    partNumber: number,
    signal: AbortSignal,
    contentType?: string,
  ): Promise<string | null> {
    return withRetry(
      async () => {
        this.reportPartProgress(partNumber, 0)
        const { etag } = await this.transport.put(url, body, {
          contentType,
          signal,
          onProgress: (loaded) => this.reportPartProgress(partNumber, loaded),
        })
        this.reportPartProgress(partNumber, body.size)
        return etag
      },
      {
        retries: this.options.partRetries,
        baseDelayMs: this.options.retryBaseDelayMs,
        signal,
        shouldRetry: (err) => err instanceof TransportError && err.retryable,
      },
    )
  }

  private reportPartProgress(partNumber: number, loaded: number): void {
    this.partProgress.set(partNumber, loaded)
    let uploadedBytes = 0
    for (const bytes of this.partProgress.values()) uploadedBytes += bytes

    // Exponential moving average keeps the speed readout from jittering.
    const now = performance.now()
    const elapsed = (now - this.throughputSample.at) / 1000
    let { bytesPerSecond } = this.snapshot
    if (elapsed >= 0.5) {
      const instant = Math.max(0, uploadedBytes - this.throughputSample.bytes) / elapsed
      bytesPerSecond = bytesPerSecond === 0 ? instant : bytesPerSecond * 0.7 + instant * 0.3
      this.throughputSample = { at: now, bytes: uploadedBytes }
    }
    this.update({ uploadedBytes, bytesPerSecond })
  }

  /** Best effort: tell the server to abort so storage isn't left holding parts. */
  private async releaseServerSide(): Promise<void> {
    const { mediaId } = this.snapshot
    if (!mediaId) return
    try {
      await this.gateway.cancel(mediaId)
    } catch {
      // The server-side stale-upload sweeper is the safety net.
    }
  }

  private update(patch: Partial<UploadSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    this.onChange()
  }
}

export const isTerminal = (s: UploadStatus) =>
  s === 'completed' || s === 'failed' || s === 'cancelled'

function describeError(err: unknown): string {
  if (err instanceof TransportError) {
    if (err.status === 0) return 'Network error while uploading'
    if (err.status === 403) return 'Upload link expired or was rejected by storage'
    return `Storage rejected the upload (${err.status})`
  }
  return err instanceof Error ? err.message : 'Upload failed'
}
