/**
 * Cancellation error. A plain Error subclass (not DOMException, which React
 * Native lacks), named 'AbortError' like the platform's own abort errors.
 */
export class UploadAbortedError extends Error {
  override readonly name = 'AbortError'
  constructor() {
    super('Upload cancelled')
  }
}

export const abortError = () => new UploadAbortedError()

export const isAbortError = (err: unknown) => err instanceof Error && err.name === 'AbortError'

export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortError())
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(abortError())
      },
      { once: true },
    )
  })
}

/**
 * Retries `fn` with exponential backoff + jitter while `shouldRetry` says so.
 * Never retries after the signal is aborted.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: {
    retries: number
    baseDelayMs: number
    signal: AbortSignal
    shouldRetry: (err: unknown) => boolean
  },
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(attempt)
    } catch (err) {
      if (opts.signal.aborted || attempt >= opts.retries || !opts.shouldRetry(err)) throw err
      const delay = opts.baseDelayMs * 2 ** attempt * (0.5 + Math.random() / 2)
      await sleep(delay, opts.signal)
    }
  }
}

/** Runs `worker` over `items` with at most `limit` in flight. Fails fast on the first error. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  let failed = false

  const lane = async () => {
    while (!failed && next < items.length) {
      const index = next++
      try {
        results[index] = await worker(items[index] as T)
      } catch (err) {
        failed = true
        throw err
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane))
  return results
}
