import { Pressable, StyleSheet, Text, View } from 'react-native'
import { radius, spacing, useTheme } from '@/lib/theme'

interface Props<T extends string> {
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
}

export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  const { colors } = useTheme()
  return (
    <View accessibilityRole="tablist" style={[styles.track, { backgroundColor: colors.surface2 }]}>
      {options.map((o) => {
        const selected = o.value === value
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.item, selected && { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.label, { color: selected ? colors.fg : colors.fgMuted }]}>
              {o.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: radius.sm + 2, padding: 2 },
  item: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm - 2, borderRadius: radius.sm },
  label: { fontSize: 14, fontWeight: '600' },
})
