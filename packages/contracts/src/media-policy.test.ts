import { describe, expect, it } from 'vitest'
import {
  checkUploadPolicy,
  formatBytes,
  MAX_SIZE_BYTES,
  mediaKindFromMimeType,
} from './media-policy'

describe('mediaKindFromMimeType', () => {
  it('classifies supported types', () => {
    expect(mediaKindFromMimeType('image/png')).toBe('image')
    expect(mediaKindFromMimeType('video/mp4')).toBe('video')
  })

  it('rejects unsupported types', () => {
    expect(mediaKindFromMimeType('application/pdf')).toBeNull()
    expect(mediaKindFromMimeType('')).toBeNull()
  })
})

describe('checkUploadPolicy', () => {
  it('accepts a valid file', () => {
    expect(checkUploadPolicy({ mimeType: 'image/jpeg', sizeBytes: 1024 })).toBeNull()
  })

  it('rejects files above the per-kind limit', () => {
    const result = checkUploadPolicy({
      mimeType: 'image/jpeg',
      sizeBytes: MAX_SIZE_BYTES.image + 1,
    })
    expect(result?.code).toBe('FILE_TOO_LARGE')
  })

  it('rejects empty files and unsupported types', () => {
    expect(checkUploadPolicy({ mimeType: 'video/mp4', sizeBytes: 0 })?.code).toBe('EMPTY_FILE')
    expect(checkUploadPolicy({ mimeType: 'text/plain', sizeBytes: 10 })?.code).toBe(
      'UNSUPPORTED_TYPE',
    )
  })
})

describe('formatBytes', () => {
  it('formats human readable sizes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(50 * 1024 * 1024)).toBe('50 MB')
  })
})
