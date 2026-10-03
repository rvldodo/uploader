import type { ComponentProps } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { radius, spacing, useTheme } from '@/lib/theme'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

interface Props extends Omit<ComponentProps<typeof Pressable>, 'children'> {
  title: string
  variant?: Variant
  loading?: boolean
  icon?: React.ReactNode
}

export function Button({
  title,
  variant = 'primary',
  loading,
  icon,
  disabled,
  style,
  ...props
}: Props) {
  const { colors } = useTheme()
  const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.accent, fg: colors.accentFg },
    secondary: { bg: colors.surface, fg: colors.fg, border: colors.border },
    danger: { bg: colors.danger, fg: '#fff' },
    ghost: { bg: 'transparent', fg: colors.fgMuted },
  }
  const p = palette[variant]
  const isDisabled = disabled || loading

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        {
          backgroundColor: p.bg,
          borderColor: p.border ?? p.bg,
          opacity: isDisabled ? 0.5 : state.pressed ? 0.85 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text style={[styles.label, { color: p.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontSize: 16, fontWeight: '600' },
})
