import type { Media } from './media'

/**
 * How a viewer relates to a media item. The single source of truth for
 * "who can see what":
 *
 * - owner:  full control (visibility, sharing, delete)
 * - shared: explicitly shared with this user, view only
 * - public: visibility is public, view only, no login needed
 * - none:   must not even learn the item exists
 */
export type MediaAccess = 'owner' | 'shared' | 'public' | 'none'

export function resolveMediaAccess(
  media: Media,
  viewerId: string | null,
  isSharedWithViewer: boolean,
): MediaAccess {
  if (media.isOwnedBy(viewerId)) return 'owner'
  // Only finished media is ever visible to non-owners (no half-uploaded or failed files).
  if (media.status !== 'ready') return 'none'
  if (viewerId !== null && isSharedWithViewer) return 'shared'
  if (media.visibility === 'public') return 'public'
  return 'none'
}
