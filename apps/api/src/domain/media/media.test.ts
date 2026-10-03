import { describe, expect, it } from 'vitest'
import {
  InvalidStateError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  UploadVerificationError,
} from '../errors'
import { Media } from './media'

const now = new Date('2026-01-01T00:00:00Z')
const later = new Date('2026-01-01T00:05:00Z')

function newVideo(sizeBytes = 1000) {
  return Media.create({
    id: '00000000-0000-4000-8000-000000000001',
    ownerId: 'owner-id',
    filename: 'holiday.MP4',
    mimeType: 'video/mp4',
    sizeBytes,
    now,
  })
}

describe('Media.create', () => {
  it('starts in the uploading state with a derived storage key', () => {
    const media = newVideo()
    expect(media.status).toBe('uploading')
    expect(media.kind).toBe('video')
    expect(media.storageKey).toBe('media/00000000-0000-4000-8000-000000000001/original.mp4')
  })

  it('strips directory components from the filename', () => {
    const media = Media.create({
      id: 'id',
      ownerId: 'owner-id',
      filename: '../../etc/passwd.png',
      mimeType: 'image/png',
      sizeBytes: 1,
      now,
    })
    expect(media.toSnapshot().filename).toBe('passwd.png')
  })

  it('enforces the upload policy', () => {
    const base = { id: 'id', ownerId: 'owner-id', filename: 'a', now }
    expect(() => Media.create({ ...base, mimeType: 'application/zip', sizeBytes: 1 })).toThrow(
      UnsupportedMediaTypeError,
    )
    expect(() =>
      Media.create({ ...base, mimeType: 'image/png', sizeBytes: 10 * 1024 ** 3 }),
    ).toThrow(PayloadTooLargeError)
  })
})

describe('Media lifecycle', () => {
  it('moves uploading → processing → ready', () => {
    const media = newVideo()
    media.attachMultipartUpload('upload-1')
    media.markUploaded(1000, later)
    expect(media.status).toBe('processing')
    expect(media.multipartUploadId).toBeNull()

    media.markReady({ width: 1920, height: 1080, durationMs: 5000, thumbnailKey: 'thumb' }, later)
    expect(media.status).toBe('ready')
    expect(media.toSnapshot()).toMatchObject({ width: 1920, durationMs: 5000, updatedAt: later })
  })

  it('rejects an upload whose stored size differs from the declared size', () => {
    const media = newVideo(1000)
    expect(() => media.markUploaded(999, later)).toThrow(UploadVerificationError)
    expect(media.status).toBe('uploading')
  })

  it('forbids illegal transitions', () => {
    const media = newVideo()
    media.cancel('user cancelled', later)
    expect(() => media.markUploaded(1000, later)).toThrow(InvalidStateError)
    expect(() =>
      media.markReady({ width: 1, height: 1, durationMs: null, thumbnailKey: 'k' }, later),
    ).toThrow(InvalidStateError)
  })

  it('defaults to private and lets the owner change visibility', () => {
    const media = newVideo()
    expect(media.visibility).toBe('private')
    media.changeVisibility('public', later)
    expect(media.visibility).toBe('public')
    media.cancel('x', later)
    expect(() => media.changeVisibility('private', later)).toThrow(InvalidStateError)
  })

  it('truncates very long failure reasons', () => {
    const media = newVideo()
    media.markUploaded(1000, later)
    media.markFailed('x'.repeat(2000), later)
    expect(media.toSnapshot().failureReason).toHaveLength(500)
  })
})
