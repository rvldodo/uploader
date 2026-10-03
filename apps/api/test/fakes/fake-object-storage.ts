import type { ObjectStorage, UploadedPart } from '../../src/application/ports/object-storage'

/** Records calls and keeps objects in memory; signed URLs are deterministic fakes. */
export class FakeObjectStorage implements ObjectStorage {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>()
  readonly multipart = new Map<
    string,
    { key: string; completed?: UploadedPart[]; aborted?: boolean }
  >()
  private nextUploadId = 1

  async createSignedUploadUrl(key: string) {
    return `https://storage.test/${key}?signed=put`
  }

  async createMultipartUpload(key: string) {
    const id = `upload-${this.nextUploadId++}`
    this.multipart.set(id, { key })
    return id
  }

  async createSignedPartUploadUrls(key: string, uploadId: string, partCount: number) {
    return Array.from({ length: partCount }, (_, i) => ({
      partNumber: i + 1,
      url: `https://storage.test/${key}?uploadId=${uploadId}&part=${i + 1}`,
    }))
  }

  async completeMultipartUpload(_key: string, uploadId: string, parts: UploadedPart[]) {
    const session = this.multipart.get(uploadId)
    if (!session) throw new Error('NoSuchUpload')
    session.completed = parts
  }

  async abortMultipartUpload(_key: string, uploadId: string) {
    const session = this.multipart.get(uploadId)
    if (session) session.aborted = true
  }

  async stat(key: string) {
    const obj = this.objects.get(key)
    return obj ? { sizeBytes: obj.body.length, contentType: obj.contentType } : null
  }

  async createSignedDownloadUrl(key: string) {
    return `https://storage.test/${key}?signed=get`
  }

  async downloadToTempFile(key: string) {
    if (!this.objects.has(key)) throw new Error(`NoSuchKey: ${key}`)
    return { path: `/tmp/fake/${key}`, dispose: async () => {} }
  }

  async put(key: string, body: Buffer, contentType: string) {
    this.objects.set(key, { body, contentType })
  }

  async deletePrefix(prefix: string) {
    for (const key of this.objects.keys()) if (key.startsWith(prefix)) this.objects.delete(key)
  }

  /** Test helper: simulate the browser having uploaded `size` bytes. */
  simulateUpload(key: string, size: number, contentType = 'application/octet-stream') {
    this.objects.set(key, { body: Buffer.alloc(size), contentType })
  }
}
