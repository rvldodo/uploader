export interface StoredObjectInfo {
  sizeBytes: number
  contentType: string | null
}

export interface UploadedPart {
  partNumber: number
  etag: string
}

/** A file materialised on local disk. Call `dispose` when done with it. */
export interface LocalFile {
  path: string
  dispose(): Promise<void>
}

/**
 * Port for a blob store with S3 semantics (single PUT, multipart, signed URLs).
 * The bucket is private: clients only ever touch it through short-lived signed URLs.
 */
export interface ObjectStorage {
  createSignedUploadUrl(key: string, contentType: string, expiresInSeconds: number): Promise<string>

  createMultipartUpload(key: string, contentType: string): Promise<string>
  createSignedPartUploadUrls(
    key: string,
    uploadId: string,
    partCount: number,
    expiresInSeconds: number,
  ): Promise<Array<{ partNumber: number; url: string }>>
  completeMultipartUpload(key: string, uploadId: string, parts: UploadedPart[]): Promise<void>
  abortMultipartUpload(key: string, uploadId: string): Promise<void>

  /** Returns null if the object does not exist. */
  stat(key: string): Promise<StoredObjectInfo | null>
  createSignedDownloadUrl(key: string, expiresInSeconds: number): Promise<string>

  downloadToTempFile(key: string): Promise<LocalFile>
  put(key: string, body: Buffer, contentType: string): Promise<void>
  deletePrefix(prefix: string): Promise<void>
}
