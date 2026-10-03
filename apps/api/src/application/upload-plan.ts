const MiB = 1024 * 1024

/** S3 limits: parts are 5 MiB–5 GiB (last part may be smaller), at most 10,000 per upload. */
export const S3_MIN_PART_SIZE = 5 * MiB
export const S3_MAX_PARTS = 10_000

export type UploadPlan =
  | { strategy: 'single' }
  | { strategy: 'multipart'; partSize: number; partCount: number }

/**
 * Decides how a file of `sizeBytes` should be uploaded.
 *
 * Files up to `preferredPartSize` go in one PUT (one round-trip, no
 * multipart bookkeeping). Larger files use multipart so they can be sent in
 * parallel and retried part-by-part. The part size grows if needed to stay
 * under the 10,000-part limit.
 */
export function planUpload(sizeBytes: number, preferredPartSize: number): UploadPlan {
  if (sizeBytes <= preferredPartSize) return { strategy: 'single' }

  const minPartSizeForLimit = Math.ceil(sizeBytes / S3_MAX_PARTS)
  const partSize = Math.max(preferredPartSize, minPartSizeForLimit, S3_MIN_PART_SIZE)
  return { strategy: 'multipart', partSize, partCount: Math.ceil(sizeBytes / partSize) }
}
