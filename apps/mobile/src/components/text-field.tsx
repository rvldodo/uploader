import { forwardRef } from 'react'
import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native'
import { radius, spacing, useTheme } from '@/lib/theme'

interface Props extends TextInputProps {
  label: string
  error?: string
  hint?: string
}

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, error, hint, style, ...props },
  ref,
) {
  const { colors } = useTheme()
  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: colors.fg }]}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.fgSubtle}
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            color: colors.fg,
            borderColor: error ? colors.danger : colors.border,
          },
          style,
        ]}
        {...props}
      />
      {error ? (
        <Text style={[styles.help, { color: colors.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.help, { color: colors.fgMuted }]}>{hint}</Text>
      ) : null}
    </View>
  )
})

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  help: { fontSize: 13 },
})
