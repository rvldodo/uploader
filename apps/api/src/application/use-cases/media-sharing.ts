import type { ListMediaSharesResponse, MediaShareDto } from '@media-upload/contracts'
import { NotFoundError, ValidationError } from '../../domain/errors'
import { normalizeEmail } from '../../domain/user/user'
import type { Actor } from '../actor'
import type { MediaAccessGuard } from '../media-access-guard'
import type { MediaShareRepository } from '../ports/media-share-repository'
import type { Clock } from '../ports/system'
import type { UserRepository } from '../ports/user-repository'
import { toUserDto } from './auth/session-issuer'

/** Grants another user view access to one of the actor's files. */
export class ShareMedia {
  constructor(
    private readonly guard: MediaAccessGuard,
    private readonly shares: MediaShareRepository,
    private readonly users: UserRepository,
    private readonly clock: Clock,
  ) {}

  async execute(actor: Actor, input: { mediaId: string; email: string }): Promise<MediaShareDto> {
    const media = await this.guard.requireOwned(input.mediaId, actor)

    // Trade-off: this tells the owner whether an email has an account. Acceptable
    // for sharing UX (same as most products); login stays non-enumerable.
    const recipient = await this.users.findByEmail(normalizeEmail(input.email))
    if (!recipient) throw new NotFoundError('No account found with that email')
    if (recipient.id === actor.userId) throw new ValidationError('You already own this file')

    const now = this.clock.now()
    await this.shares.add({ mediaId: media.id, userId: recipient.id, createdAt: now })
    return { user: toUserDto(recipient), createdAt: now.toISOString() }
  }
}

/** Revokes a share. Idempotent. */
export class UnshareMedia {
  constructor(
    private readonly guard: MediaAccessGuard,
    private readonly shares: MediaShareRepository,
  ) {}

  async execute(actor: Actor, input: { mediaId: string; userId: string }): Promise<void> {
    const media = await this.guard.requireOwned(input.mediaId, actor)
    await this.shares.remove(media.id, input.userId)
  }
}

/** Who has access to the actor's file (owner only). */
export class ListMediaShares {
  constructor(
    private readonly guard: MediaAccessGuard,
    private readonly shares: MediaShareRepository,
    private readonly users: UserRepository,
  ) {}

  async execute(actor: Actor, input: { mediaId: string }): Promise<ListMediaSharesResponse> {
    const media = await this.guard.requireOwned(input.mediaId, actor)
    const shares = await this.shares.listForMedia(media.id)
    const users = new Map(
      (await this.users.findByIds(shares.map((s) => s.userId))).map((u) => [u.id, u]),
    )

    return {
      items: shares.flatMap((s) => {
        const user = users.get(s.userId)
        return user ? [{ user: toUserDto(user), createdAt: s.createdAt.toISOString() }] : []
      }),
    }
  }
}
