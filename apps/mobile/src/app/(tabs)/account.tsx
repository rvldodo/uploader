import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Button } from '@/components/button'
import { useAuth, useCurrentUser } from '@/features/auth/auth-context'
import { useUploads } from '@/features/upload/upload-queue-context'
import { config } from '@/lib/config'
import { radius, spacing, useTheme } from '@/lib/theme'

export default function AccountScreen() {
  const { colors } = useTheme()
  const user = useCurrentUser()
  const { logout } = useAuth()
  const { queue } = useUploads()
  const [signingOut, setSigningOut] = useState(false)

  const confirmLogout = () => {
    const doLogout = async () => {
      setSigningOut(true)
      await logout()
    }
    if (!queue.hasActiveUploads) return void doLogout()
    Alert.alert('Uploads in progress', 'Logging out will cancel them.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: doLogout },
    ])
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
      <View style={styles.profile}>
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
          <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={[styles.name, { color: colors.fg }]}>{user.name}</Text>
        <Text style={{ color: colors.fgMuted }}>{user.email}</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Row icon="server-outline" label="Server" value={config.apiUrl} />
      </View>

      <Button
        title="Log out"
        variant="secondary"
        loading={signingOut}
        icon={<Ionicons name="log-out-outline" size={18} color={colors.danger} />}
        onPress={confirmLogout}
      />
    </ScrollView>
  )
}

function Row({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
}) {
  const { colors } = useTheme()
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.fgMuted} />
      <Text style={{ color: colors.fg, flex: 1 }}>{label}</Text>
      <Text numberOfLines={1} style={{ color: colors.fgMuted, flexShrink: 1 }}>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, gap: spacing.xl },
  profile: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { color: '#fff', fontSize: 30, fontWeight: '700' },
  name: { fontSize: 22, fontWeight: '700' },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
})
