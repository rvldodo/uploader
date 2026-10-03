import type { MediaDto, MediaKind, MediaListScope } from '@media-upload/contracts'
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import { mediaApi } from './media-api'

const PAGE_SIZE = 30
const PROCESSING_POLL_MS = 2_000

/** Same key structure as the web app, so the two stay easy to reason about together. */
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
    queryFn: ({ pageParam }) => mediaApi.list({ scope, limit: PAGE_SIZE, cursor: pageParam, kind }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: (query) =>
      query.state.data?.pages.some((p) => p.items.some(isProcessing)) ? PROCESSING_POLL_MS : false,
  })

export const mediaDetailQuery = (id: string) =>
  queryOptions({
    queryKey: mediaKeys.detail(id),
    queryFn: () => mediaApi.get(id),
    refetchInterval: (query) =>
      query.state.data && isProcessing(query.state.data) ? PROCESSING_POLL_MS : false,
  })

export const mediaSharesQuery = (id: string) =>
  queryOptions({ queryKey: mediaKeys.shares(id), queryFn: () => mediaApi.listShares(id) })
