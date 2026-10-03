import { describe, expect, it } from 'vitest'
import { UnprocessableMediaError } from '../src/application/ports/media-analyzer'
import { InvalidStateError, NotFoundError, UploadVerificationError } from '../src/domain/errors'
import { createTestHarness } from './fakes/test-harness'

const MiB = 1024 * 1024

describe('upload flow', () => {
  it('single PUT: initiate → upload → complete → process → ready', async () => {
    const h = createTestHarness()
    const alice = await h.signUp('Alice')

    const init = await h.useCases.initiateUpload.execute(alice, {
      filename: 'cat.png',
      mimeType: 'image/png',
      sizeBytes: 2 * MiB,
    })
    expect(init.instructions.strategy).toBe('single')

    const key = h.repo.rows.get(init.mediaId)?.storageKey as string
    h.storage.simulateUpload(key, 2 * MiB)

    const completed = await h.useCases.completeUpload.execute(alice, { mediaId: init.mediaId })
    expect(completed.status).toBe('processing')
    expect(completed.url).toBeNull()
    expect(h.enqueued).toEqual([init.mediaId])

    expect(await h.useCases.processMedia.execute({ mediaId: init.mediaId })).toBe('ready')

    const media = await h.useCases.getMedia.execute(alice, { mediaId: init.mediaId })
    expect(media).toMatchObject({ status: 'ready', width: 640, height: 480 })
    expect(media.thumbnailUrl).toContain('thumbnail.webp')
    expect(h.storage.objects.has(`media/${init.mediaId}/thumbnail.webp`)).toBe(true)
  })

  it('multipart: completes the storage session with sorted parts', async () => {
    const h = createTestHarness()
    const alice = await h.signUp('Alice')
    const init = await h.useCases.initiateUpload.execute(alice, {
      filename: 'movie.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 40 * MiB,
    })
    if (init.instructions.strategy !== 'multipart') throw new Error('expected multipart')
    expect(init.instructions.parts).toHaveLength(3)

    const key = h.repo.rows.get(init.mediaId)?.storageKey as string
    h.storage.simulateUpload(key, 40 * MiB)

    await h.useCases.completeUpload.execute(alice, {
      mediaId: init.mediaId,
      parts: [
        { partNumber: 3, etag: 'c' },
        { partNumber: 1, etag: 'a' },
        { partNumber: 2, etag: 'b' },
      ],
    })

    const [session] = h.storage.multipart.values()
    expect(session?.completed?.map((p) => p.partNumber)).toEqual([1, 2, 3])
  })

  it('rejects completion when the stored object is missing or truncated', async () => {
    const h = createTestHarness()
    const alice = await h.signUp('Alice')
    const init = await h.useCases.initiateUpload.execute(alice, {
      filename: 'a.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
    })

    await expect(
      h.useCases.completeUpload.execute(alice, { mediaId: init.mediaId }),
    ).rejects.toThrow(UploadVerificationError)

    h.storage.simulateUpload(h.repo.rows.get(init.mediaId)?.storageKey as string, 10)
    await expect(
      h.useCases.completeUpload.execute(alice, { mediaId: init.mediaId }),
    ).rejects.toThrow(UploadVerificationError)
    expect(h.enqueued).toHaveLength(0)
  })

  it('treats a repeated complete call as a no-op (idempotent)', async () => {
    const h = createTestHarness()
    const alice = await h.signUp('Alice')
    const init = await h.useCases.initiateUpload.execute(alice, {
      filename: 'a.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
    })
    h.storage.simulateUpload(h.repo.rows.get(init.mediaId)?.storageKey as string, 1000)

    await h.useCases.completeUpload.execute(alice, { mediaId: init.mediaId })
    const again = await h.useCases.completeUpload.execute(alice, { mediaId: init.mediaId })
    expect(again.status).toBe('processing')
    expect(h.enqueued).toHaveLength(1)
  })

  it('cancels an upload and aborts the multipart session', async () => {
    const h = createTestHarness()
    const alice = await h.signUp('Alice')
    const init = await h.useCases.initiateUpload.execute(alice, {
      filename: 'movie.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 40 * MiB,
    })

    await h.useCases.cancelUpload.execute(alice, { mediaId: init.mediaId })

    expect(h.repo.rows.get(init.mediaId)?.status).toBe('cancelled')
    expect([...h.storage.multipart.values()][0]?.aborted).toBe(true)
    await expect(
      h.useCases.completeUpload.execute(alice, { mediaId: init.mediaId }),
    ).rejects.toThrow(InvalidStateError)
    await expect(h.useCases.getMedia.execute(alice, { mediaId: init.mediaId })).rejects.toThrow(
      NotFoundError,
    )
  })
})

describe('processing', () => {
  async function uploadedMedia() {
    const h = createTestHarness()
    const alice = await h.signUp('Alice')
    const init = await h.useCases.initiateUpload.execute(alice, {
      filename: 'clip.webm',
      mimeType: 'video/webm',
      sizeBytes: 100,
    })
    h.storage.simulateUpload(h.repo.rows.get(init.mediaId)?.storageKey as string, 100)
    await h.useCases.completeUpload.execute(alice, { mediaId: init.mediaId })
    return { h, alice, mediaId: init.mediaId }
  }

  it('fails the media without retrying when content is unprocessable', async () => {
    const { h, mediaId } = await uploadedMedia()
    h.analyzer.next = async () => {
      throw new UnprocessableMediaError('File is not a valid video')
    }

    expect(await h.useCases.processMedia.execute({ mediaId })).toBe('failed')
    expect(h.repo.rows.get(mediaId)).toMatchObject({
      status: 'failed',
      failureReason: 'File is not a valid video',
    })
  })

  it('propagates infrastructure errors so the queue can retry', async () => {
    const { h, mediaId } = await uploadedMedia()
    h.analyzer.next = async () => {
      throw new Error('ECONNRESET')
    }

    await expect(h.useCases.processMedia.execute({ mediaId })).rejects.toThrow('ECONNRESET')
    expect(h.repo.rows.get(mediaId)?.status).toBe('processing')

    await h.useCases.markProcessingFailed.execute({ mediaId, reason: 'gave up' })
    expect(h.repo.rows.get(mediaId)?.status).toBe('failed')
  })

  it('skips duplicate deliveries', async () => {
    const { h, mediaId } = await uploadedMedia()
    expect(await h.useCases.processMedia.execute({ mediaId })).toBe('ready')
    expect(await h.useCases.processMedia.execute({ mediaId })).toBe('skipped')
  })
})

describe('library', () => {
  it('lists ready media newest-first with cursor pagination', async () => {
    const h = createTestHarness()
    const alice = await h.signUp('Alice')
    const ids: string[] = []
    for (let i = 0; i < 5; i++) {
      const init = await h.useCases.initiateUpload.execute(alice, {
        filename: `${i}.png`,
        mimeType: 'image/png',
        sizeBytes: 10,
      })
      h.storage.simulateUpload(h.repo.rows.get(init.mediaId)?.storageKey as string, 10)
      await h.useCases.completeUpload.execute(alice, { mediaId: init.mediaId })
      ids.push(init.mediaId)
      h.clock.advance(1000)
    }
    // An in-flight upload must not show up in the library.
    await h.useCases.initiateUpload.execute(alice, {
      filename: 'x.png',
      mimeType: 'image/png',
      sizeBytes: 1,
    })

    const page1 = await h.useCases.listMedia.execute(alice, { scope: 'mine', limit: 2 })
    expect(page1.items.map((m) => m.id)).toEqual([ids[4], ids[3]])
    expect(page1.nextCursor).not.toBeNull()

    const page2 = await h.useCases.listMedia.execute(alice, {
      scope: 'mine',
      limit: 2,
      cursor: page1.nextCursor as string,
    })
    expect(page2.items.map((m) => m.id)).toEqual([ids[2], ids[1]])

    const page3 = await h.useCases.listMedia.execute(alice, {
      scope: 'mine',
      limit: 2,
      cursor: page2.nextCursor as string,
    })
    expect(page3.items.map((m) => m.id)).toEqual([ids[0]])
    expect(page3.nextCursor).toBeNull()
  })

  it('deletes all objects of a media item', async () => {
    const h = createTestHarness()
    const alice = await h.signUp('Alice')
    const init = await h.useCases.initiateUpload.execute(alice, {
      filename: 'a.png',
      mimeType: 'image/png',
      sizeBytes: 10,
    })
    h.storage.simulateUpload(h.repo.rows.get(init.mediaId)?.storageKey as string, 10)
    await h.useCases.completeUpload.execute(alice, { mediaId: init.mediaId })
    await h.useCases.processMedia.execute({ mediaId: init.mediaId })
    expect(h.storage.objects.size).toBe(2)

    await h.useCases.deleteMedia.execute(alice, { mediaId: init.mediaId })
    expect(h.storage.objects.size).toBe(0)
    expect(h.repo.rows.has(init.mediaId)).toBe(false)
  })
})

describe('stale upload sweeper', () => {
  it('expires only uploads older than the max age', async () => {
    const h = createTestHarness()
    const alice = await h.signUp('Alice')
    const old = await h.useCases.initiateUpload.execute(alice, {
      filename: 'old.png',
      mimeType: 'image/png',
      sizeBytes: 10,
    })
    h.clock.advance(23 * 3600 * 1000)
    const recent = await h.useCases.initiateUpload.execute(alice, {
      filename: 'new.png',
      mimeType: 'image/png',
      sizeBytes: 10,
    })
    h.clock.advance(2 * 3600 * 1000)

    expect(await h.useCases.expireStaleUploads.execute()).toBe(1)
    expect(h.repo.rows.get(old.mediaId)).toMatchObject({
      status: 'cancelled',
      failureReason: 'Upload expired',
    })
    expect(h.repo.rows.get(recent.mediaId)?.status).toBe('uploading')
  })
})
