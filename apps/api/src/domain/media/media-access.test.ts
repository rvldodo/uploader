import { describe, expect, it } from 'vitest'
import { Media } from './media'
import { resolveMediaAccess } from './media-access'

const now = new Date('2026-01-01T00:00:00Z')
const OWNER = 'owner-id'
const OTHER = 'other-id'

function media(opts: { visibility?: 'private' | 'public'; uploaded?: boolean } = {}) {
  const m = Media.create({
    id: 'm1',
    ownerId: OWNER,
    visibility: opts.visibility,
    filename: 'a.png',
    mimeType: 'image/png',
    sizeBytes: 10,
    now,
  })
  if (opts.uploaded !== false) {
    m.markUploaded(10, now)
    m.markReady({ width: 1, height: 1, durationMs: null, thumbnailKey: 't' }, now)
  }
  return m
}

describe('resolveMediaAccess', () => {
  it('gives the owner full access, even while uploading', () => {
    expect(resolveMediaAccess(media({ uploaded: false }), OWNER, false)).toBe('owner')
  })

  it('hides private media from everyone else', () => {
    expect(resolveMediaAccess(media(), OTHER, false)).toBe('none')
    expect(resolveMediaAccess(media(), null, false)).toBe('none')
  })

  it('grants view access to users it was shared with', () => {
    expect(resolveMediaAccess(media(), OTHER, true)).toBe('shared')
  })

  it('makes public media viewable by anyone, including anonymous visitors', () => {
    expect(resolveMediaAccess(media({ visibility: 'public' }), null, false)).toBe('public')
  })

  it('never exposes unfinished media to non-owners, even if public or shared', () => {
    expect(resolveMediaAccess(media({ visibility: 'public', uploaded: false }), null, false)).toBe(
      'none',
    )
    expect(resolveMediaAccess(media({ uploaded: false }), OTHER, true)).toBe('none')
  })
})
