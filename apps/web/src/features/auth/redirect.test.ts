import { describe, expect, it } from 'vitest'
import { safeRedirect } from './redirect'

describe('safeRedirect', () => {
  it('allows same-origin paths', () => {
    expect(safeRedirect('/media/123?x=1')).toBe('/media/123?x=1')
  })

  it('rejects absolute and protocol-relative URLs', () => {
    expect(safeRedirect('https://evil.example')).toBe('/')
    expect(safeRedirect('//evil.example')).toBe('/')
    expect(safeRedirect('/\\evil.example')).toBe('/')
    expect(safeRedirect(undefined)).toBe('/')
  })
})
