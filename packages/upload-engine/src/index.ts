/**
 * Upload engine shared by the web app and the mobile app.
 *
 * Pure TypeScript with no framework or platform imports: the network
 * (`UploadGateway`, `BlobTransport`) and the file (`UploadSource`) are ports
 * that each app adapts. Both browsers and React Native provide
 * XMLHttpRequest, Blob.slice and AbortController, so `xhrTransport` works in both.
 */
export { isAbortError, UploadAbortedError } from './async'
export type {
  BlobTransport,
  UploadGateway,
  UploadSnapshot,
  UploadSource,
  UploadStatus,
} from './types'
export { TransportError } from './types'
export { UploadQueue, type UploadQueueOptions } from './upload-queue'
export { defaultTaskOptions, isTerminal, UploadTask, type UploadTaskOptions } from './upload-task'
export { xhrTransport } from './xhr-transport'
