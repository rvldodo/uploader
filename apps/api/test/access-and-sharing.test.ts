import { describe, expect, it } from 'vitest'
import { ForbiddenError, NotFoundError, ValidationError } from '../src/domain/errors'
import { createTestHarness } from './fakes/test-harness'

async function setup() {
  const h = createTestHarness()
  const alice = await h.signUp('Alice')
  const bob = await h.signUp('Bob')
  return { h, alice, bob }
}

describe('ownership & visibility', () => {
  it('keeps private media invisible to other users and anonymous visitors', async () => {
    const { h, alice, bob } = await setup()
    const id = await h.uploadReady(alice)

    await expect(h.useCases.getMedia.execute(bob, { mediaId: id })).rejects.toThrow(NotFoundError)
    await expect(h.useCases.getMedia.execute(null, { mediaId: id })).rejects.toThrow(NotFoundError)
    const own = await h.useCases.getMedia.execute(alice, { mediaId: id })
    expect(own).toMatchObject({
      viewerRole: 'owner',
      visibility: 'private',
      owner: { name: 'Alice' },
    })
  })

  it('lets anyone view public media, read-only', async () => {
    const { h, alice, bob } = await setup()
    const id = await h.uploadReady(alice, { visibility: 'public' })

    const anon = await h.useCases.getMedia.execute(null, { mediaId: id })
    expect(anon).toMatchObject({ viewerRole: 'viewer', owner: { id: alice.userId, name: 'Alice' } })
    expect(anon.url).toBeTruthy()
    expect(anon.owner).not.toHaveProperty('email')

    await expect(h.useCases.deleteMedia.execute(bob, { mediaId: id })).rejects.toThrow(
      ForbiddenError,
    )
  })

  it('only lets the owner change visibility', async () => {
    const { h, alice, bob } = await setup()
    const id = await h.uploadReady(alice)

    await expect(
      h.useCases.updateMediaVisibility.execute(bob, { mediaId: id, visibility: 'public' }),
    ).rejects.toThrow(NotFoundError) // can't even see it

    const updated = await h.useCases.updateMediaVisibility.execute(alice, {
      mediaId: id,
      visibility: 'public',
    })
    expect(updated.visibility).toBe('public')
    await expect(h.useCases.getMedia.execute(null, { mediaId: id })).resolves.toBeTruthy()
  })

  it('lists only my own media in "mine"', async () => {
    const { h, alice, bob } = await setup()
    const mine = await h.uploadReady(alice)
    await h.uploadReady(bob, { visibility: 'public' })

    const page = await h.useCases.listMedia.execute(alice, { scope: 'mine', limit: 10 })
    expect(page.items.map((m) => m.id)).toEqual([mine])
  })

  it('does not let other users complete or cancel my upload', async () => {
    const { h, alice, bob } = await setup()
    const init = await h.useCases.initiateUpload.execute(alice, {
      filename: 'a.png',
      mimeType: 'image/png',
      sizeBytes: 10,
    })
    await expect(h.useCases.completeUpload.execute(bob, { mediaId: init.mediaId })).rejects.toThrow(
      NotFoundError,
    )
    await expect(h.useCases.cancelUpload.execute(bob, { mediaId: init.mediaId })).rejects.toThrow(
      NotFoundError,
    )
  })
})

describe('sharing', () => {
  it('shares a private file with a specific user by email', async () => {
    const { h, alice, bob } = await setup()
    const carol = await h.signUp('Carol')
    const id = await h.uploadReady(alice)

    const share = await h.useCases.shareMedia.execute(alice, {
      mediaId: id,
      email: 'BOB@example.com',
    })
    expect(share.user).toMatchObject({ id: bob.userId, email: bob.email })

    const asBob = await h.useCases.getMedia.execute(bob, { mediaId: id })
    expect(asBob.viewerRole).toBe('viewer')
    await expect(h.useCases.getMedia.execute(carol, { mediaId: id })).rejects.toThrow(NotFoundError)

    const shared = await h.useCases.listMedia.execute(bob, { scope: 'shared', limit: 10 })
    expect(shared.items.map((m) => m.id)).toEqual([id])
    expect(
      (await h.useCases.listMedia.execute(carol, { scope: 'shared', limit: 10 })).items,
    ).toEqual([])
  })

  it('does not let a viewer re-share, list shares or delete', async () => {
    const { h, alice, bob } = await setup()
    const carol = await h.signUp('Carol')
    const id = await h.uploadReady(alice)
    await h.useCases.shareMedia.execute(alice, { mediaId: id, email: bob.email })

    await expect(
      h.useCases.shareMedia.execute(bob, { mediaId: id, email: carol.email }),
    ).rejects.toThrow(ForbiddenError)
    await expect(h.useCases.listMediaShares.execute(bob, { mediaId: id })).rejects.toThrow(
      ForbiddenError,
    )
    await expect(h.useCases.deleteMedia.execute(bob, { mediaId: id })).rejects.toThrow(
      ForbiddenError,
    )
  })

  it('revokes access when unshared', async () => {
    const { h, alice, bob } = await setup()
    const id = await h.uploadReady(alice)
    await h.useCases.shareMedia.execute(alice, { mediaId: id, email: bob.email })

    await h.useCases.unshareMedia.execute(alice, { mediaId: id, userId: bob.userId })

    await expect(h.useCases.getMedia.execute(bob, { mediaId: id })).rejects.toThrow(NotFoundError)
    expect((await h.useCases.listMediaShares.execute(alice, { mediaId: id })).items).toEqual([])
  })

  it('is idempotent and validates the recipient', async () => {
    const { h, alice, bob } = await setup()
    const id = await h.uploadReady(alice)

    await h.useCases.shareMedia.execute(alice, { mediaId: id, email: bob.email })
    await h.useCases.shareMedia.execute(alice, { mediaId: id, email: bob.email })
    expect((await h.useCases.listMediaShares.execute(alice, { mediaId: id })).items).toHaveLength(1)

    await expect(
      h.useCases.shareMedia.execute(alice, { mediaId: id, email: alice.email }),
    ).rejects.toThrow(ValidationError)
    await expect(
      h.useCases.shareMedia.execute(alice, { mediaId: id, email: 'nobody@example.com' }),
    ).rejects.toThrow(NotFoundError)
  })

  it('removes shares when the media is deleted', async () => {
    const { h, alice, bob } = await setup()
    const id = await h.uploadReady(alice)
    await h.useCases.shareMedia.execute(alice, { mediaId: id, email: bob.email })

    await h.useCases.deleteMedia.execute(alice, { mediaId: id })
    expect(h.shares.rows).toHaveLength(0)
  })
})
