import type { MediaDto, MediaKind, MediaListScope } from '@media-upload/contracts'
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import { getMedia, listMedia, listMediaShares } from './media.functions'

const PAGE_SIZE = 24
const PROCESSING_POLL_MS = 2_000

/** Centralised query keys: invalidate `mediaKeys.all` to refresh everything media related. */
export const mediaKeys = {
  all: ['media'] as const,
  lists: () => [...mediaKeys.all, 'list'] as const,
  list: (scope: MediaListScope, kind?: MediaKind) =>
    [...mediaKeys.lists(), { scope, kind: kind ?? 'all' }] as const,
  detail: (id: string) => [...mediaKeys.all, 'detail', id] as const,
  shares: (id: string) => [...mediaKeys.all, 'shares', id] as const,
}

const isProcessing = (m: MediaDto) => m.status === 'processing'

export const mediaListQuery = (scope: MediaListScope, kind?: MediaKind) =>
  infiniteQueryOptions({
    queryKey: mediaKeys.list(scope, kind),
    queryFn: ({ pageParam }) =>
      listMedia({ data: { scope, limit: PAGE_SIZE, cursor: pageParam, kind } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // Poll only while something is still being processed. Upgrade path: SSE/websocket push.
    refetchInterval: (query) =>
      query.state.data?.pages.some((p) => p.items.some(isProcessing)) ? PROCESSING_POLL_MS : false,
  })

export const mediaDetailQuery = (mediaId: string) =>
  queryOptions({
    queryKey: mediaKeys.detail(mediaId),
    queryFn: () => getMedia({ data: { mediaId } }),
    refetchInterval: (query) =>
      query.state.data && isProcessing(query.state.data) ? PROCESSING_POLL_MS : false,
  })

export const mediaSharesQuery = (mediaId: string) =>
  queryOptions({
    queryKey: mediaKeys.shares(mediaId),
    queryFn: () => listMediaShares({ data: { mediaId } }),
  })
