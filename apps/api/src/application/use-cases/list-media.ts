import type { ListMediaResponse, MediaKind, MediaListScope } from '@media-upload/contracts'
import type { MediaStatus } from '../../domain/media/media'
import type { Actor } from '../actor'
import type { MediaViewFactory } from '../media-view'
import { decodeCursor, encodeCursor } from '../pagination'
import type { MediaRepository } from '../ports/media-repository'

/** Owners also see their items still processing or failed; others only see finished ones. */
const STATUSES_BY_SCOPE: Record<MediaListScope, readonly MediaStatus[]> = {
  mine: ['processing', 'ready', 'failed'],
  shared: ['ready'],
}

export class ListMedia {
  constructor(
    private readonly repo: MediaRepository,
    private readonly views: MediaViewFactory,
  ) {}

  async execute(
    actor: Actor,
    input: { scope: MediaListScope; limit: number; cursor?: string; kind?: MediaKind },
  ): Promise<ListMediaResponse> {
    // Fetch one extra row to know whether another page exists without a COUNT query.
    const rows = await this.repo.list({
      ...(input.scope === 'mine' ? { ownerId: actor.userId } : { sharedWithUserId: actor.userId }),
      limit: input.limit + 1,
      after: input.cursor ? decodeCursor(input.cursor) : undefined,
      kind: input.kind,
      statuses: STATUSES_BY_SCOPE[input.scope],
    })

    const page = rows.slice(0, input.limit)
    const last = page.at(-1)
    const nextCursor =
      rows.length > input.limit && last
        ? encodeCursor({ createdAt: last.toSnapshot().createdAt, id: last.id })
        : null

    return { items: await this.views.toViews(page, actor), nextCursor }
  }
}
