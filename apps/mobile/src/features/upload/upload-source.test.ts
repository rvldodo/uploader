import { describe, expect, it } from 'vitest'
import { createUploadSource, normalizeFileName, resolveMimeType } from './upload-source'

describe('resolveMimeType', () => {
  it('prefers picker metadata, then falls back to the extension', () => {
    expect(resolveMimeType('IMAGE/JPEG', 'x.png')).toBe('image/jpeg')
    expect(resolveMimeType(null, 'clip.MOV')).toBe('video/quicktime')
    expect(resolveMimeType(undefined, 'noext')).toBe('application/octet-stream')
  })
})

describe('normalizeFileName', () => {
  it('fixes stale extensions after iOS converts HEIC to JPEG', () => {
    expect(normalizeFileName('IMG_0001.HEIC', 'image/jpeg')).toBe('IMG_0001.jpg')
  })

  it('invents a name when the picker gives none', () => {
    expect(normalizeFileName(null, 'video/mp4', 42)).toBe('VID_42.mp4')
    expect(normalizeFileName('', 'image/png', 7)).toBe('IMG_7.png')
  })
})

describe('createUploadSource', () => {
  it('exposes the blob through the UploadSource port', async () => {
    const blob = new Blob([new Uint8Array(100)])
    const source = await createUploadSource(
      { uri: 'file:///x/IMG_1.HEIC', fileName: 'IMG_1.HEIC', mimeType: 'image/jpeg' },
      async () => blob,
    )
    expect(source).toMatchObject({ name: 'IMG_1.jpg', size: 100, type: 'image/jpeg' })
    expect(source.slice(10, 30).size).toBe(20)
  })
})
