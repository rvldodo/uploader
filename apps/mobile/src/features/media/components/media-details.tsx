import type { MediaDto } from '@media-upload/contracts'
import { StyleSheet, Text, View } from 'react-native'
import { formatBytes, formatDate, formatDuration } from '@/lib/format'
import { radius, spacing, useTheme } from '@/lib/theme'

export function MediaDetails({ media }: { media: MediaDto }) {
  const { colors } = useTheme()
  const rows: Array<[string, string]> = [
    ['Owner', media.viewerRole === 'owner' ? 'You' : media.owner.name],
    ['Visibility', media.visibility === 'public' ? 'Public link' : 'Private'],
    ['Type', media.mimeType],
    ['Size', formatBytes(media.sizeBytes)],
  ]
  if (media.width && media.height) rows.push(['Dimensions', `${media.width} × ${media.height}`])
  if (media.durationMs !== null) rows.push(['Duration', formatDuration(media.durationMs)])
  rows.push(['Uploaded', formatDate(media.createdAt)])

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {rows.map(([label, value], i) => (
        <View
          key={label}
          style={[
            styles.row,
            i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
          ]}
        >
          <Text style={{ color: colors.fgMuted }}>{label}</Text>
          <Text style={{ color: colors.fg, fontWeight: '500', flexShrink: 1, textAlign: 'right' }}>
            {value}
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
    padding: spacing.md,
  },
})
