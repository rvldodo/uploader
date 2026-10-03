import { Ionicons } from '@expo/vector-icons'
import type { MediaDto } from '@media-upload/contracts'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { spacing, useTheme } from '@/lib/theme'

export function MediaViewer({ media }: { media: MediaDto }) {
  const { colors } = useTheme()
  const aspectRatio = media.width && media.height ? media.width / media.height : 4 / 3

  if (media.status !== 'ready' || !media.url) {
    return (
      <View style={[styles.placeholder, { backgroundColor: colors.surface2 }]}>
        {media.status === 'processing' ? (
          <>
            <ActivityIndicator color={colors.fgMuted} />
            <Text style={{ color: colors.fgMuted }}>Processing… this updates automatically.</Text>
          </>
        ) : (
          <>
            <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
            <Text style={{ color: colors.danger, textAlign: 'center' }}>
              {media.failureReason ?? 'This file could not be processed.'}
            </Text>
          </>
        )}
      </View>
    )
  }

  if (media.kind === 'video') return <VideoPlayer url={media.url} aspectRatio={aspectRatio} />

  return (
    <Image
      source={{ uri: media.url }}
      placeholder={media.thumbnailUrl ? { uri: media.thumbnailUrl } : undefined}
      contentFit="contain"
      accessibilityLabel={media.filename}
      style={{ width: '100%', aspectRatio: Math.max(aspectRatio, 0.6), backgroundColor: '#000' }}
    />
  )
}

function VideoPlayer({ url, aspectRatio }: { url: string; aspectRatio: number }) {
  const player = useVideoPlayer(url)
  return (
    <VideoView
      player={player}
      nativeControls
      fullscreenOptions={{ enable: true }}
      contentFit="contain"
      style={{ width: '100%', aspectRatio: Math.max(aspectRatio, 0.6), backgroundColor: '#000' }}
    />
  )
}

const styles = StyleSheet.create({
  placeholder: {
    aspectRatio: 4 / 3,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
})
