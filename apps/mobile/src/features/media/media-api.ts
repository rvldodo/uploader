import {
  type CompletedPart,
  type InitiateUploadRequest,
  initiateUploadResponseSchema,
  listMediaResponseSchema,
  listMediaSharesResponseSchema,
  type MediaKind,
  type MediaListScope,
  type MediaVisibility,
  mediaDtoSchema,
  mediaShareDtoSchema,
} from '@media-upload/contracts'
import { api } from '@/lib/api'

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
})

export const mediaApi = {
  list: (params: { scope: MediaListScope; limit: number; cursor?: string; kind?: MediaKind }) => {
    const qs = new URLSearchParams({ scope: params.scope, limit: String(params.limit) })
    if (params.cursor) qs.set('cursor', params.cursor)
    if (params.kind) qs.set('kind', params.kind)
    return api.request(`/v1/media?${qs}`, listMediaResponseSchema)
  },
  get: (id: string) => api.request(`/v1/media/${id}`, mediaDtoSchema),
  setVisibility: (id: string, visibility: MediaVisibility) =>
    api.request(`/v1/media/${id}`, mediaDtoSchema, json('PATCH', { visibility })),
  remove: (id: string) => api.requestVoid(`/v1/media/${id}`, json('DELETE')),

  listShares: (id: string) => api.request(`/v1/media/${id}/shares`, listMediaSharesResponseSchema),
  share: (id: string, email: string) =>
    api.request(`/v1/media/${id}/shares`, mediaShareDtoSchema, json('POST', { email })),
  unshare: (id: string, userId: string) =>
    api.requestVoid(`/v1/media/${id}/shares/${userId}`, json('DELETE')),

  initiateUpload: (body: InitiateUploadRequest) =>
    api.request('/v1/uploads', initiateUploadResponseSchema, json('POST', body)),
  completeUpload: (id: string, parts?: CompletedPart[]) =>
    api.request(`/v1/uploads/${id}/complete`, mediaDtoSchema, json('POST', { parts })),
  cancelUpload: (id: string) => api.requestVoid(`/v1/uploads/${id}`, json('DELETE')),
}
