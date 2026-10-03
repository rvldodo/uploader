/** Hands media off to asynchronous processing (thumbnails, metadata extraction). */
export interface MediaProcessingQueue {
  enqueue(mediaId: string): Promise<void>
}
