import { z } from 'zod'
import { publicUserDtoSchema, userDtoSchema } from './auth'
import { MEDIA_KINDS } from './media-policy'

/* ------------------------------------------------------------------ */
/* Media                                                               */
/* ------------------------------------------------------------------ */

export const MEDIA_STATUSES = ['uploading', 'processing', 'ready', 'failed', 'cancelled'] as const
/** `private`: owner + people it is shared with. `public`: anyone with the link, no login needed. */
export const MEDIA_VISIBILITIES = ['private', 'public'] as const

export const mediaKindSchema = z.enum(MEDIA_KINDS)
export const mediaStatusSchema = z.enum(MEDIA_STATUSES)
export const mediaIdSchema = z.uuid()
export const mediaVisibilitySchema = z.enum(MEDIA_VISIBILITIES)
export type MediaVisibility = z.infer<typeof mediaVisibilitySchema>

export const mediaDtoSchema = z.object({
  id: mediaIdSchema,
  kind: mediaKindSchema,
  status: mediaStatusSchema,
  visibility: mediaVisibilitySchema,
  owner: publicUserDtoSchema,
  /** What the requesting user may do: `owner` can manage, `viewer` can only view. */
  viewerRole: z.enum(['owner', 'viewer']),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  durationMs: z.number().int().nullable(),
  failureReason: z.string().nullable(),
  /** Short-lived signed URL to the original file. Present only when `status === 'ready'`. */
  url: z.url().nullable(),
  /** Short-lived signed URL to a WebP thumbnail. Present only when `status === 'ready'`. */
  thumbnailUrl: z.url().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})
export type MediaDto = z.infer<typeof mediaDtoSchema>
export type MediaStatus = z.infer<typeof mediaStatusSchema>

/** `mine`: files I own. `shared`: files other people shared with me. */
export const MEDIA_LIST_SCOPES = ['mine', 'shared'] as const
export type MediaListScope = (typeof MEDIA_LIST_SCOPES)[number]

export const listMediaQuerySchema = z.object({
  scope: z.enum(MEDIA_LIST_SCOPES).default('mine'),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  kind: mediaKindSchema.optional(),
})
export type ListMediaQuery = z.input<typeof listMediaQuerySchema>

export const listMediaResponseSchema = z.object({
  items: z.array(mediaDtoSchema),
  nextCursor: z.string().nullable(),
})
export type ListMediaResponse = z.infer<typeof listMediaResponseSchema>

export const updateMediaRequestSchema = z.object({
  visibility: mediaVisibilitySchema,
})
export type UpdateMediaRequest = z.infer<typeof updateMediaRequestSchema>

/* ------------------------------------------------------------------ */
/* Sharing                                                             */
/* ------------------------------------------------------------------ */

export const shareMediaRequestSchema = z.object({
  email: z.email().trim().toLowerCase(),
})
export type ShareMediaRequest = z.infer<typeof shareMediaRequestSchema>

export const mediaShareDtoSchema = z.object({
  user: userDtoSchema,
  createdAt: z.iso.datetime(),
})
export type MediaShareDto = z.infer<typeof mediaShareDtoSchema>

export const listMediaSharesResponseSchema = z.object({
  items: z.array(mediaShareDtoSchema),
})
export type ListMediaSharesResponse = z.infer<typeof listMediaSharesResponseSchema>

/* ------------------------------------------------------------------ */
/* Uploads                                                             */
/* ------------------------------------------------------------------ */

export const initiateUploadRequestSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().min(1).max(127),
  sizeBytes: z.number().int().positive(),
  visibility: mediaVisibilitySchema.default('private'),
})
export type InitiateUploadRequest = z.input<typeof initiateUploadRequestSchema>

export const uploadPartTargetSchema = z.object({
  partNumber: z.number().int().min(1).max(10_000),
  url: z.url(),
})
export type UploadPartTarget = z.infer<typeof uploadPartTargetSchema>

/**
 * How the client must send the bytes.
 * - `single`: one PUT to `url` (small files).
 * - `multipart`: PUT each `partSize` slice to its URL, collect the ETags, then complete.
 */
export const uploadInstructionsSchema = z.discriminatedUnion('strategy', [
  z.object({
    strategy: z.literal('single'),
    url: z.url(),
  }),
  z.object({
    strategy: z.literal('multipart'),
    partSize: z.number().int().positive(),
    parts: z.array(uploadPartTargetSchema).min(1),
  }),
])
export type UploadInstructions = z.infer<typeof uploadInstructionsSchema>

export const initiateUploadResponseSchema = z.object({
  mediaId: mediaIdSchema,
  expiresAt: z.iso.datetime(),
  instructions: uploadInstructionsSchema,
})
export type InitiateUploadResponse = z.infer<typeof initiateUploadResponseSchema>

export const completedPartSchema = z.object({
  partNumber: z.number().int().min(1).max(10_000),
  etag: z.string().min(1),
})
export type CompletedPart = z.infer<typeof completedPartSchema>

export const completeUploadRequestSchema = z.object({
  /** Required for multipart uploads, ignored for single uploads. */
  parts: z.array(completedPartSchema).max(10_000).optional(),
})
export type CompleteUploadRequest = z.infer<typeof completeUploadRequestSchema>

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'UNSUPPORTED_MEDIA_TYPE',
  'PAYLOAD_TOO_LARGE',
  'UPLOAD_VERIFICATION_FAILED',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

/** Every non-2xx API response has this shape. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    requestId: z.string().optional(),
    details: z.unknown().optional(),
  }),
})
export type ApiError = z.infer<typeof apiErrorSchema>
