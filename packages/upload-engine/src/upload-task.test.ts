import type { InitiateUploadResponse, MediaDto } from '@media-upload/contracts'
import { describe, expect, it, vi } from 'vitest'
import { type BlobTransport, TransportError, type UploadGateway } from './types'
import { UploadTask } from './upload-task'

const MEDIA_ID = '00000000-0000-4000-8000-000000000001'
const fastRetry = { partConcurrency: 2, partRetries: 2, retryBaseDelayMs: 1 }

function file(size: number, type = 'video/mp4') {
  return new File([new Uint8Array(size)], 'clip.mp4', { type })
}

function gateway(instructions: InitiateUploadResponse['instructions']): UploadGateway & {
  completed: unknown[]
  cancelled: string[]
} {
  const completed: unknown[] = []
  const cancelled: string[] = []
  return {
    completed,
    cancelled,
    initiate: async () => ({
      mediaId: MEDIA_ID,
      expiresAt: new Date().toISOString(),
      instructions,
    }),
    complete: async (input) => {
      completed.push(input)
      return { id: MEDIA_ID, status: 'processing' } as MediaDto
    },
    cancel: async (id) => void cancelled.push(id),
  }
}

const okTransport: BlobTransport = {
  put: async (url, body, { onProgress }) => {
    onProgress(body.size)
    return { etag: `"etag-${new URL(url).searchParams.get('part') ?? 'single'}"` }
  },
}

const multipart = (count: number, partSize: number) => ({
  strategy: 'multipart' as const,
  partSize,
  parts: Array.from({ length: count }, (_, i) => ({
    partNumber: i + 1,
    url: `https://s3.test/key?part=${i + 1}`,
  })),
})

describe('UploadTask', () => {
  it('uploads a small file with a single PUT and completes without parts', async () => {
    const gw = gateway({ strategy: 'single', url: 'https://s3.test/key' })
    const task = new UploadTask('t1', file(100), gw, okTransport, () => {}, fastRetry)

    await task.run()

    expect(task.getSnapshot()).toMatchObject({
      status: 'completed',
      uploadedBytes: 100,
      mediaId: MEDIA_ID,
    })
    expect(gw.completed).toEqual([{ mediaId: MEDIA_ID, parts: undefined }])
  })

  it('requests the chosen visibility when initiating', async () => {
    const gw = gateway({ strategy: 'single', url: 'https://s3.test/key' })
    const initiate = vi.spyOn(gw, 'initiate')
    await new UploadTask('t1', file(100), gw, okTransport, () => {}, fastRetry, 'public').run()
    expect(initiate).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'public' }))
  })

  it('slices multipart uploads and reports every ETag', async () => {
    const gw = gateway(multipart(3, 40))
    const sizes: number[] = []
    const transport: BlobTransport = {
      put: async (url, body, opts) => {
        sizes.push(body.size)
        return okTransport.put(url, body, opts)
      },
    }

    await new UploadTask('t1', file(100), gw, transport, () => {}, fastRetry).run()

    expect(sizes.sort((a, b) => a - b)).toEqual([20, 40, 40])
    expect(gw.completed[0]).toMatchObject({
      parts: [
        { partNumber: 1, etag: '"etag-1"' },
        { partNumber: 2, etag: '"etag-2"' },
        { partNumber: 3, etag: '"etag-3"' },
      ],
    })
  })

  it('retries transient failures for a part', async () => {
    const gw = gateway(multipart(1, 100))
    let calls = 0
    const flaky: BlobTransport = {
      put: async (url, body, opts) => {
        if (++calls < 3) throw new TransportError('boom', 503)
        return okTransport.put(url, body, opts)
      },
    }

    const task = new UploadTask('t1', file(100), gw, flaky, () => {}, fastRetry)
    await task.run()

    expect(calls).toBe(3)
    expect(task.getSnapshot().status).toBe('completed')
  })

  it('does not retry permanent failures and releases the server-side upload', async () => {
    const gw = gateway(multipart(1, 100))
    const put = vi.fn(async () => {
      throw new TransportError('forbidden', 403)
    })

    const task = new UploadTask('t1', file(100), gw, { put }, () => {}, fastRetry)
    await task.run()

    expect(put).toHaveBeenCalledTimes(1)
    expect(task.getSnapshot()).toMatchObject({
      status: 'failed',
      error: 'Upload link expired or was rejected by storage',
    })
    expect(gw.cancelled).toEqual([MEDIA_ID])
  })

  it('cancels in-flight uploads', async () => {
    const gw = gateway({ strategy: 'single', url: 'https://s3.test/key' })
    const hanging: BlobTransport = {
      put: (_url, _body, { signal }) =>
        new Promise((_, reject) =>
          signal.addEventListener('abort', () =>
            reject(Object.assign(new Error('x'), { name: 'AbortError' })),
          ),
        ),
    }

    const task = new UploadTask('t1', file(100), gw, hanging, () => {}, fastRetry)
    const running = task.run()
    await vi.waitFor(() => expect(task.getSnapshot().mediaId).toBe(MEDIA_ID))
    task.cancel()
    await running

    expect(task.getSnapshot().status).toBe('cancelled')
    expect(gw.cancelled).toEqual([MEDIA_ID])
  })
})
