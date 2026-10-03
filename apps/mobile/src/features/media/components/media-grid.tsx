import type { MediaKind, MediaListScope } from '@media-upload/contracts'
import { useInfiniteQuery } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  useWindowDimensions,
  View,
} from 'react-native'
import { EmptyState, ErrorView, LoadingView } from '@/components/state-views'
import { useTheme } from '@/lib/theme'
import { mediaListQuery } from '../media-queries'
import { MediaTile } from './media-tile'

const COLUMNS = 3
const GAP = 2

interface Props {
  scope: MediaListScope
  kind?: MediaKind
  header?: ReactElement
}

/** Photos-app style grid with infinite scroll and pull-to-refresh. */
export function MediaGrid({ scope, kind, header }: Props) {
  const { colors } = useTheme()
  const { width } = useWindowDimensions()
  const tileSize = (width - GAP * (COLUMNS - 1)) / COLUMNS
  const query = useInfiniteQuery(mediaListQuery(scope, kind))

  if (query.isPending) return <LoadingView />
  if (query.isError)
    return <ErrorView message={query.error.message} onRetry={() => query.refetch()} />

  const items = query.data.pages.flatMap((p) => p.items)

  return (
    <FlatList
      data={items}
      keyExtractor={(m) => m.id}
      numColumns={COLUMNS}
      columnWrapperStyle={{ gap: GAP }}
      contentContainerStyle={{ gap: GAP, paddingBottom: 32 }}
      style={{ backgroundColor: colors.bg }}
      renderItem={({ item }) => <MediaTile media={item} size={tileSize} />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        scope === 'shared' ? (
          <EmptyState
            icon="people-outline"
            title="Nothing shared yet"
            message="Files other people share with you will appear here."
          />
        ) : (
          <EmptyState
            icon="images-outline"
            title="No files yet"
            message="Tap + to upload photos and videos."
          />
        )
      }
      onEndReachedThreshold={0.5}
      onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <View style={{ padding: 16 }}>
            <ActivityIndicator color={colors.fgMuted} />
          </View>
        ) : null
      }
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => query.refetch()}
          tintColor={colors.fgMuted}
        />
      }
    />
  )
}
