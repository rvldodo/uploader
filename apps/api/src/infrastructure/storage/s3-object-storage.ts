import { createWriteStream } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  NoSuchUpload,
  NotFound,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type {
  LocalFile,
  ObjectStorage,
  StoredObjectInfo,
  UploadedPart,
} from '../../application/ports/object-storage'

export interface S3StorageConfig {
  bucket: string
  region: string
  endpoint?: string
  /** Host used in signed URLs given to browsers; may differ from the internal endpoint. */
  publicEndpoint?: string
  forcePathStyle: boolean
  accessKeyId: string
  secretAccessKey: string
}

/**
 * ObjectStorage adapter for any S3-compatible store (AWS S3, RustFS, MinIO, R2, ...).
 *
 * Two clients are kept on purpose: `client` talks to storage from inside the
 * network, `signer` only produces signed URLs whose host is reachable by the
 * browser. Signing is a local HMAC computation, so `signer` never makes calls.
 */
export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client
  private readonly signer: S3Client
  private readonly bucket: string

  constructor(config: S3StorageConfig) {
    const base = {
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      // Only send/validate checksums when an operation requires them; browsers
      // PUT to presigned URLs and cannot attach SDK-computed checksums.
      requestChecksumCalculation: 'WHEN_REQUIRED' as const,
      responseChecksumValidation: 'WHEN_REQUIRED' as const,
    }
    this.client = new S3Client({ ...base, endpoint: config.endpoint })
    this.signer = new S3Client({ ...base, endpoint: config.publicEndpoint ?? config.endpoint })
    this.bucket = config.bucket
  }

  /** Exposed for operational scripts (bucket bootstrap); not part of the port. */
  get rawClient(): S3Client {
    return this.client
  }

  createSignedUploadUrl(key: string, contentType: string, expiresIn: number): Promise<string> {
    return getSignedUrl(
      this.signer,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn },
    )
  }

  async createMultipartUpload(key: string, contentType: string): Promise<string> {
    const res = await this.client.send(
      new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
    )
    if (!res.UploadId) throw new Error('Storage did not return an UploadId')
    return res.UploadId
  }

  createSignedPartUploadUrls(key: string, uploadId: string, partCount: number, expiresIn: number) {
    return Promise.all(
      Array.from({ length: partCount }, async (_, i) => {
        const partNumber = i + 1
        const url = await getSignedUrl(
          this.signer,
          new UploadPartCommand({
            Bucket: this.bucket,
            Key: key,
            UploadId: uploadId,
            PartNumber: partNumber,
          }),
          { expiresIn },
        )
        return { partNumber, url }
      }),
    )
  }

  async completeMultipartUpload(key: string, uploadId: string, parts: UploadedPart[]) {
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
        },
      }),
    )
  }

  async abortMultipartUpload(key: string, uploadId: string) {
    try {
      await this.client.send(
        new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId }),
      )
    } catch (err) {
      if (!(err instanceof NoSuchUpload)) throw err // already gone: fine
    }
  }

  async stat(key: string): Promise<StoredObjectInfo | null> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      return { sizeBytes: res.ContentLength ?? 0, contentType: res.ContentType ?? null }
    } catch (err) {
      if (err instanceof NotFound || err instanceof NoSuchKey) return null
      throw err
    }
  }

  createSignedDownloadUrl(key: string, expiresIn: number): Promise<string> {
    return getSignedUrl(this.signer, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn,
    })
  }

  async downloadToTempFile(key: string): Promise<LocalFile> {
    const dir = await mkdtemp(join(tmpdir(), 'media-'))
    const dispose = () => rm(dir, { recursive: true, force: true })
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
      const path = join(dir, 'source')
      // Stream to disk: videos can be gigabytes and must never be buffered in memory.
      await pipeline(res.Body as Readable, createWriteStream(path))
      return { path, dispose }
    } catch (err) {
      await dispose()
      throw err
    }
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    )
  }

  async deletePrefix(prefix: string) {
    let token: string | undefined
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      )
      const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []))
      if (keys.length > 0) {
        await this.client.send(
          new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys, Quiet: true } }),
        )
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined
    } while (token)
  }
}
