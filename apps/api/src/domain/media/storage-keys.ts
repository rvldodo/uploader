/**
 * Object storage layout. Every object belonging to one media item lives under
 * a single prefix, so deleting a media item is a single prefix delete and the
 * bucket stays easy to reason about:
 *
 *   media/<id>/original.<ext>
 *   media/<id>/thumbnail.webp
 */
export const mediaStorageKeys = {
  prefix: (mediaId: string) => `media/${mediaId}/`,

  original: (mediaId: string, filename: string) => {
    const ext = extensionOf(filename)
    return `media/${mediaId}/original${ext ? `.${ext}` : ''}`
  },

  thumbnail: (mediaId: string) => `media/${mediaId}/thumbnail.webp`,
}

function extensionOf(filename: string): string {
  const match = /\.([a-z0-9]{1,10})$/i.exec(filename)
  return match?.[1]?.toLowerCase() ?? ''
}
