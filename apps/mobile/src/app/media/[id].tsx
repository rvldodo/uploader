import { mediaIdSchema } from '@media-upload/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Button } from '@/components/button'
import { EmptyState, ErrorView, LoadingView } from '@/components/state-views'
import { useAuth } from '@/features/auth/auth-context'
import { MediaDetails } from '@/features/media/components/media-details'
import { MediaViewer } from '@/features/media/components/media-viewer'
import { SharingSection } from '@/features/media/components/sharing-section'
import { mediaApi } from '@/features/media/media-api'
import { mediaDetailQuery, mediaKeys } from '@/features/media/media-queries'
import { isNotFound } from '@/lib/api-client'
import { spacing, useTheme } from '@/lib/theme'

/** Also the deep-link target: mediabox://media/<id>. Works signed out for public files. */
export default function MediaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const valid = mediaIdSchema.safeParse(id).success
  const { colors } = useTheme()
  const { state } = useAuth()
  const query = useQuery({ ...mediaDetailQuery(id), enabled: valid })

  if (!valid || (query.isError && isNotFound(query.error))) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <EmptyState
          icon="lock-closed-outline"
          title="Not available"
          message={
            state.status === 'signedIn'
              ? "This file doesn't exist, or it hasn't been shared with you."
              : "This file is private or doesn't exist. If it was shared with you, log in to view it."
          }
        />
        {state.status !== 'signedIn' && (
          <View style={{ paddingHorizontal: spacing.xl }}>
            <Button title="Log in" onPress={() => router.replace('/login')} />
          </View>
        )}
      </View>
    )
  }
  if (query.isPending) return <LoadingView />
  if (query.isError)
    return <ErrorView message={query.error.message} onRetry={() => query.refetch()} />

  const media = query.data
  const isOwner = media.viewerRole === 'owner'

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
    >
      <Stack.Screen options={{ title: media.filename }} />
      <MediaViewer media={media} />
      <View style={styles.body}>
        {!isOwner && (
          <Text style={{ color: colors.fgMuted, fontSize: 15 }}>Shared by {media.owner.name}</Text>
        )}
        <MediaDetails media={media} />
        {isOwner && media.status === 'ready' && <SharingSection media={media} />}
        {isOwner && <DeleteButton mediaId={media.id} />}
      </View>
    </ScrollView>
  )
}

function DeleteButton({ mediaId }: { mediaId: string }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => mediaApi.remove(mediaId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: mediaKeys.detail(mediaId) })
      await queryClient.invalidateQueries({ queryKey: mediaKeys.lists() })
      router.back()
    },
    onError: (err) => Alert.alert("Couldn't delete", err.message),
  })

  return (
    <Button
      title="Delete"
      variant="danger"
      loading={mutation.isPending}
      onPress={() =>
        Alert.alert(
          'Delete this file?',
          'It will be permanently removed for you and everyone it was shared with.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => mutation.mutate() },
          ],
        )
      }
    />
  )
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg },
})
