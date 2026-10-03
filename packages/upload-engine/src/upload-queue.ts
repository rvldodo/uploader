import { checkUploadPolicy, type MediaVisibility } from '@media-upload/contracts'
import type { BlobTransport, UploadGateway, UploadSnapshot, UploadSource } from './types'
import { defaultTaskOptions, isTerminal, UploadTask, type UploadTaskOptions } from './upload-task'

export interface UploadQueueOptions {
  /** Files uploaded at the same time; the rest wait in line. */
  fileConcurrency: number
  task: UploadTaskOptions
  onCompleted?: (snapshot: UploadSnapshot) => void
}

/**
 * Observable queue of uploads with bounded concurrency.
 *
 * Implements the `subscribe`/`getSnapshot` contract of React's
 * `useSyncExternalStore`, so it can be consumed without any React-specific
 * code inside. The snapshot array is replaced (never mutated) on change.
 */
export class UploadQueue {
  private tasks: UploadTask[] = []
  private snapshot: readonly UploadSnapshot[] = []
  private readonly listeners = new Set<() => void>()
  private readonly options: UploadQueueOptions
  private seq = 0

  constructor(
    private readonly gateway: UploadGateway,
    private readonly transport: BlobTransport,
    options: Partial<UploadQueueOptions> = {},
  ) {
    this.options = { fileConcurrency: 2, task: defaultTaskOptions, ...options }
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): readonly UploadSnapshot[] => this.snapshot

  get hasActiveUploads(): boolean {
    return this.snapshot.some((s) => !isTerminal(s.status))
  }

  add(files: Iterable<UploadSource>, options: { visibility?: MediaVisibility } = {}): void {
    for (const file of files) {
      const task = this.createTask(file, options.visibility)
      // Instant feedback using the same policy the server enforces.
      const violation = checkUploadPolicy({ mimeType: file.type, sizeBytes: file.size })
      if (violation) task.reject(violation.message)
      this.tasks.push(task)
    }
    this.emit()
    this.pump()
  }

  cancel(id: string): void {
    this.find(id)?.cancel()
  }

  retry(id: string): void {
    const index = this.tasks.findIndex((t) => t.id === id)
    const old = this.tasks[index]
    if (!old || !['failed', 'cancelled'].includes(old.getSnapshot().status)) return
    this.tasks[index] = this.createTask(old.file, old.visibility)
    this.emit()
    this.pump()
  }

  dismiss(id: string): void {
    const task = this.find(id)
    if (task && !isTerminal(task.getSnapshot().status)) task.cancel()
    this.tasks = this.tasks.filter((t) => t.id !== id)
    this.emit()
  }

  clearFinished(): void {
    this.tasks = this.tasks.filter((t) => !isTerminal(t.getSnapshot().status))
    this.emit()
  }

  private createTask(file: UploadSource, visibility: MediaVisibility = 'private'): UploadTask {
    const id = `upload-${++this.seq}`
    let lastStatus: UploadSnapshot['status'] = 'queued'
    const task: UploadTask = new UploadTask(
      id,
      file,
      this.gateway,
      this.transport,
      () => {
        const snap = task.getSnapshot()
        if (snap.status !== lastStatus) {
          lastStatus = snap.status
          if (snap.status === 'completed') this.options.onCompleted?.(snap)
          if (isTerminal(snap.status)) queueMicrotask(() => this.pump())
        }
        this.emit()
      },
      this.options.task,
      visibility,
    )
    return task
  }

  /** Starts queued tasks until the concurrency limit is reached. */
  private pump(): void {
    const active = this.tasks.filter((t) => {
      const s = t.getSnapshot().status
      return s === 'uploading' || s === 'finalizing'
    }).length
    const slots = this.options.fileConcurrency - active
    if (slots <= 0) return
    for (const task of this.tasks
      .filter((t) => t.getSnapshot().status === 'queued')
      .slice(0, slots)) {
      void task.run()
    }
  }

  private find(id: string) {
    return this.tasks.find((t) => t.id === id)
  }

  private emit(): void {
    this.snapshot = this.tasks.map((t) => t.getSnapshot())
    for (const listener of this.listeners) listener()
  }
}
