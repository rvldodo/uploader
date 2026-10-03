export interface MediaShare {
  mediaId: string
  userId: string
  createdAt: Date
}

export interface MediaShareRepository {
  /** Idempotent: sharing twice keeps the original share. */
  add(share: MediaShare): Promise<void>
  remove(mediaId: string, userId: string): Promise<void>
  exists(mediaId: string, userId: string): Promise<boolean>
  /** Oldest first. */
  listForMedia(mediaId: string): Promise<MediaShare[]>
}
