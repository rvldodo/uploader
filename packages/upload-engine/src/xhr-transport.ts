import { abortError } from './async'
import { type BlobTransport, TransportError } from './types'

/**
 * Browser transport built on XMLHttpRequest, because `fetch` still cannot
 * report *upload* progress. Bytes go directly to object storage.
 */
export const xhrTransport: BlobTransport = {
  put(url, body, { contentType, signal, onProgress }) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(abortError())

      const xhr = new XMLHttpRequest()
      xhr.open('PUT', url)
      // Must match the Content-Type the URL was signed with (single uploads only).
      if (contentType) xhr.setRequestHeader('Content-Type', contentType)

      xhr.upload.onprogress = (e) => onProgress(e.loaded)
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ etag: xhr.getResponseHeader('ETag') })
        } else {
          reject(new TransportError(`Storage responded with ${xhr.status}`, xhr.status))
        }
      }
      xhr.onerror = () => reject(new TransportError('Network error', 0))
      xhr.ontimeout = () => reject(new TransportError('Timed out', 0))
      xhr.onabort = () => reject(abortError())

      signal.addEventListener('abort', () => xhr.abort(), { once: true })
      xhr.send(body)
    })
  },
}
