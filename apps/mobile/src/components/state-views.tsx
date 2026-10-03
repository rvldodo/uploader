import { Ionicons } from '@expo/vector-icons'
import type { ComponentProps } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { spacing, useTheme } from '@/lib/theme'
import { Button } from './button'

export function LoadingView() {
  const { colors } = useTheme()
  return (
    <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <ActivityIndicator color={colors.accent} />
    </View>
  )
}

export function EmptyState({
  icon,
  title,
  message,
}: {
  icon: ComponentProps<typeof Ionicons>['name']
  title: string
  message: string
}) {
  const { colors } = useTheme()
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={40} color={colors.fgSubtle} />
      <Text style={[styles.title, { color: colors.fg }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.fgMuted }]}>{message}</Text>
    </View>
  )
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useTheme()
  return (
    <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
      <Text style={[styles.message, { color: colors.fgMuted }]}>{message}</Text>
      {onRetry && <Button title="Try again" variant="secondary" onPress={onRetry} />}
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 64,
    paddingHorizontal: spacing.xl,
  },
  title: { fontSize: 17, fontWeight: '600' },
  message: { fontSize: 15, textAlign: 'center' },
})
