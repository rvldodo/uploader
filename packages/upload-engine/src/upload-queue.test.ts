import type { MediaDto } from '@media-upload/contracts'
import { describe, expect, it } from 'vitest'
import type { BlobTransport, UploadGateway } from './types'
import { UploadQueue } from './upload-queue'

function deferredTransport() {
  const pending: Array<() => void> = []
  const transport: BlobTransport = {
    put: (_url, body, { onProgress }) =>
      new Promise((resolve) =>
        pending.push(() => {
          onProgress(body.size)
          resolve({ etag: '"e"' })
        }),
      ),
  }
  return { transport, pending }
}

let ids = 0
const gateway: UploadGateway = {
  initiate: async () => ({
    mediaId: `00000000-0000-4000-8000-${String(++ids).padStart(12, '0')}`,
    expiresAt: new Date().toISOString(),
    instructions: { strategy: 'single', url: 'https://s3.test/k' },
  }),
  complete: async () => ({ status: 'processing' }) as MediaDto,
  cancel: async () => {},
}

const png = (name: string) => new File([new Uint8Array(10)], name, { type: 'image/png' })
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('UploadQueue', () => {
  it('rejects files that violate the upload policy without calling the server', () => {
    const queue = new UploadQueue(gateway, deferredTransport().transport)
    queue.add([new File(['x'], 'notes.txt', { type: 'text/plain' })])

    expect(queue.getSnapshot()[0]).toMatchObject({ status: 'failed' })
    expect(queue.getSnapshot()[0]?.error).toMatch(/not supported/)
  })

  it('limits how many files upload at once', async () => {
    const { transport, pending } = deferredTransport()
    const completed: string[] = []
    const queue = new UploadQueue(gateway, transport, {
      fileConcurrency: 2,
      onCompleted: (s) => completed.push(s.fileName),
    })

    queue.add([png('a.png'), png('b.png'), png('c.png')])
    await flush()
    expect(queue.getSnapshot().map((s) => s.status)).toEqual(['uploading', 'uploading', 'queued'])

    pending.shift()?.()
    await flush()
    await flush()
    expect(completed).toEqual(['a.png'])
    expect(queue.getSnapshot()[2]?.status).toBe('uploading')
  })

  it('produces a new snapshot reference on every change (useSyncExternalStore contract)', () => {
    const queue = new UploadQueue(gateway, deferredTransport().transport)
    const before = queue.getSnapshot()
    queue.add([png('a.png')])
    expect(queue.getSnapshot()).not.toBe(before)
    expect(queue.getSnapshot()).toBe(queue.getSnapshot())
  })
})
