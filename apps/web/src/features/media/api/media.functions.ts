import {
  completeUploadRequestSchema,
  initiateUploadRequestSchema,
  initiateUploadResponseSchema,
  listMediaQuerySchema,
  listMediaResponseSchema,
  listMediaSharesResponseSchema,
  mediaDtoSchema,
  mediaIdSchema,
  mediaShareDtoSchema,
  shareMediaRequestSchema,
  updateMediaRequestSchema,
  userIdSchema,
} from '@media-upload/contracts'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { backendRequest } from '~/server/backend-client.server'

/**
 * Server functions = the web app's backend-for-frontend (BFF).
 *
 * The browser calls these as RPCs; they run on the TanStack Start server and
 * forward to the internal API. Benefits: the API is never exposed publicly,
 * there is no CORS between browser and API, and the session cookie is turned
 * into a Bearer token in exactly one place (backendRequest).
 */

export const listMedia = createServerFn({ method: 'GET' })
  .validator(listMediaQuerySchema)
  .handler(({ data }) => {
    const params = new URLSearchParams({ scope: data.scope, limit: String(data.limit) })
    if (data.cursor) params.set('cursor', data.cursor)
    if (data.kind) params.set('kind', data.kind)
    return backendRequest(`/v1/media?${params}`, listMediaResponseSchema)
  })

export const getMedia = createServerFn({ method: 'GET' })
  .validator(z.object({ mediaId: mediaIdSchema }))
  .handler(({ data }) => backendRequest(`/v1/media/${data.mediaId}`, mediaDtoSchema))

export const updateMediaVisibility = createServerFn({ method: 'POST' })
  .validator(updateMediaRequestSchema.extend({ mediaId: mediaIdSchema }))
  .handler(({ data: { mediaId, ...body } }) =>
    backendRequest(`/v1/media/${mediaId}`, mediaDtoSchema, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  )

export const listMediaShares = createServerFn({ method: 'GET' })
  .validator(z.object({ mediaId: mediaIdSchema }))
  .handler(({ data }) =>
    backendRequest(`/v1/media/${data.mediaId}/shares`, listMediaSharesResponseSchema),
  )

export const shareMedia = createServerFn({ method: 'POST' })
  .validator(shareMediaRequestSchema.extend({ mediaId: mediaIdSchema }))
  .handler(({ data: { mediaId, ...body } }) =>
    backendRequest(`/v1/media/${mediaId}/shares`, mediaShareDtoSchema, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  )

export const unshareMedia = createServerFn({ method: 'POST' })
  .validator(z.object({ mediaId: mediaIdSchema, userId: userIdSchema }))
  .handler(({ data }) =>
    backendRequest(`/v1/media/${data.mediaId}/shares/${data.userId}`, null, { method: 'DELETE' }),
  )

export const deleteMedia = createServerFn({ method: 'POST' })
  .validator(z.object({ mediaId: mediaIdSchema }))
  .handler(({ data }) => backendRequest(`/v1/media/${data.mediaId}`, null, { method: 'DELETE' }))

export const initiateUpload = createServerFn({ method: 'POST' })
  .validator(initiateUploadRequestSchema)
  .handler(({ data }) =>
    backendRequest('/v1/uploads', initiateUploadResponseSchema, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  )

export const completeUpload = createServerFn({ method: 'POST' })
  .validator(completeUploadRequestSchema.extend({ mediaId: mediaIdSchema }))
  .handler(({ data: { mediaId, ...body } }) =>
    backendRequest(`/v1/uploads/${mediaId}/complete`, mediaDtoSchema, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  )

export const cancelUpload = createServerFn({ method: 'POST' })
  .validator(z.object({ mediaId: mediaIdSchema }))
  .handler(({ data }) => backendRequest(`/v1/uploads/${data.mediaId}`, null, { method: 'DELETE' }))
