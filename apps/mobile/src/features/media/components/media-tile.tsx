import { Ionicons } from '@expo/vector-icons'
import type { MediaDto } from '@media-upload/contracts'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { formatDuration } from '@/lib/format'
import { radius, useTheme } from '@/lib/theme'

export function MediaTile({ media, size }: { media: MediaDto; size: number }) {
  const { colors } = useTheme()
  return (
    // Plain Pressable + router.push: <Link asChild> drops function-style props, collapsing the tile.
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/media/[id]', params: { id: media.id } })}
      accessibilityLabel={`${media.kind === 'video' ? 'Video' : 'Photo'} ${media.filename}`}
      style={({ pressed }) => [
        styles.tile,
        { width: size, height: size, backgroundColor: colors.surface2, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      {media.status === 'ready' && media.thumbnailUrl ? (
        <Image
          source={{ uri: media.thumbnailUrl }}
          // Signed URLs change on every fetch; cache by media id instead.
          recyclingKey={media.id}
          cachePolicy="memory-disk"
          contentFit="cover"
          transition={150}
          style={StyleSheet.absoluteFill}
        />
      ) : media.status === 'failed' ? (
        <Ionicons name="alert-circle-outline" size={28} color={colors.danger} />
      ) : (
        <ActivityIndicator color={colors.fgMuted} />
      )}

      {media.kind === 'video' && media.durationMs !== null && (
        <View style={styles.duration}>
          <Ionicons name="play" size={10} color="#fff" />
          <Text style={styles.durationText}>{formatDuration(media.durationMs)}</Text>
        </View>
      )}
      {media.viewerRole === 'owner' && media.visibility === 'public' && (
        <View style={styles.badge}>
          <Ionicons name="globe-outline" size={12} color="#fff" />
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radius.sm / 2,
  },
  duration: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  durationText: { color: '#fff', fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  badge: {
    position: 'absolute',
    left: 4,
    top: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    padding: 3,
  },
})
