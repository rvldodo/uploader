import { Ionicons } from '@expo/vector-icons'
import { isTerminal, type UploadSnapshot } from '@media-upload/upload-engine'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { formatBytes } from '@/lib/format'
import { radius, spacing, type ThemeColors, useTheme } from '@/lib/theme'
import { useUploads } from '../upload-queue-context'

/** In-progress and recent uploads, shown above the library grid. */
export function UploadList() {
  const { colors } = useTheme()
  const { queue, uploads } = useUploads()
  if (uploads.length === 0) return null

  const finished = uploads.filter((u) => isTerminal(u.status)).length
  const active = uploads.length - finished

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.headerText, { color: colors.fg }]}>
          {active > 0 ? `Uploading ${active} file${active === 1 ? '' : 's'}` : 'Uploads'}
        </Text>
        {finished > 0 && (
          <Pressable accessibilityRole="button" onPress={() => queue.clearFinished()} hitSlop={8}>
            <Text style={{ color: colors.accent, fontWeight: '600' }}>Clear</Text>
          </Pressable>
        )}
      </View>
      {uploads.map((u) => (
        <UploadRow
          key={u.id}
          upload={u}
          colors={colors}
          onCancel={() => queue.cancel(u.id)}
          onRetry={() => queue.retry(u.id)}
          onDismiss={() => queue.dismiss(u.id)}
        />
      ))}
    </View>
  )
}

function UploadRow({
  upload,
  colors,
  onCancel,
  onRetry,
  onDismiss,
}: {
  upload: UploadSnapshot
  colors: ThemeColors
  onCancel: () => void
  onRetry: () => void
  onDismiss: () => void
}) {
  const percent = upload.fileSize
    ? Math.min(100, (upload.uploadedBytes / upload.fileSize) * 100)
    : 0
  const barColor =
    upload.status === 'failed'
      ? colors.danger
      : upload.status === 'completed'
        ? colors.success
        : upload.status === 'cancelled'
          ? colors.fgSubtle
          : colors.accent

  const status = {
    queued: 'Waiting…',
    uploading: `${Math.floor(percent)}% · ${formatBytes(upload.uploadedBytes)} of ${formatBytes(upload.fileSize)}`,
    finalizing: 'Finalizing…',
    completed: 'Uploaded',
    failed: upload.error ?? 'Failed',
    cancelled: 'Cancelled',
  }[upload.status]

  const action =
    upload.status === 'queued' || upload.status === 'uploading'
      ? { icon: 'close' as const, label: 'Cancel upload', onPress: onCancel }
      : upload.status === 'failed' || upload.status === 'cancelled'
        ? { icon: 'refresh' as const, label: 'Retry upload', onPress: onRetry }
        : upload.status === 'completed'
          ? { icon: 'close' as const, label: 'Dismiss', onPress: onDismiss }
          : null

  return (
    <View style={styles.row}>
      <Ionicons
        name={upload.mimeType.startsWith('video/') ? 'videocam-outline' : 'image-outline'}
        size={20}
        color={colors.fgMuted}
      />
      <View style={{ flex: 1, gap: 4 }}>
        <Text numberOfLines={1} style={{ color: colors.fg, fontWeight: '500' }}>
          {upload.fileName}
        </Text>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}
          style={[styles.track, { backgroundColor: colors.surface2 }]}
        >
          <View
            style={[
              styles.bar,
              {
                backgroundColor: barColor,
                width: `${upload.status === 'failed' ? 100 : percent}%`,
              },
            ]}
          />
        </View>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 12,
            color: upload.status === 'failed' ? colors.danger : colors.fgMuted,
          }}
        >
          {status}
        </Text>
      </View>
      {action && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          hitSlop={10}
        >
          <Ionicons name={action.icon} size={20} color={colors.fgMuted} />
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    margin: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerText: { fontWeight: '600', fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  bar: { height: 4, borderRadius: 2 },
})
