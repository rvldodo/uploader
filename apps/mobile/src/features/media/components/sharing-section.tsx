import { Ionicons } from '@expo/vector-icons'
import type { MediaDto } from '@media-upload/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Alert, Pressable, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { Button } from '@/components/button'
import { config } from '@/lib/config'
import { radius, spacing, useTheme } from '@/lib/theme'
import { mediaApi } from '../media-api'
import { mediaKeys, mediaSharesQuery } from '../media-queries'

/** Owner-only: visibility, link sharing, and per-person access. */
export function SharingSection({ media }: { media: MediaDto }) {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const isPublic = media.visibility === 'public'
  const webLink = `${config.webUrl}/media/${media.id}`

  const visibility = useMutation({
    mutationFn: (next: boolean) => mediaApi.setVisibility(media.id, next ? 'public' : 'private'),
    onSuccess: (updated) => {
      queryClient.setQueryData(mediaKeys.detail(media.id), updated)
      void queryClient.invalidateQueries({ queryKey: mediaKeys.lists() })
    },
    onError: (err) => Alert.alert("Couldn't change visibility", err.message),
  })

  const shareLink = () =>
    Share.share({
      message: isPublic
        ? webLink
        : `${webLink}\n\n(Private: they'll need to log in with an account you shared it with.)`,
      url: webLink,
    })

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.heading, { color: colors.fg }]}>Sharing</Text>

      <View style={styles.switchRow}>
        <Ionicons
          name={isPublic ? 'globe-outline' : 'lock-closed-outline'}
          size={20}
          color={colors.fgMuted}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.fg, fontWeight: '600' }}>Public link</Text>
          <Text style={{ color: colors.fgMuted, fontSize: 13 }}>
            {isPublic ? 'Anyone with the link can view' : 'Only you and people you share with'}
          </Text>
        </View>
        <Switch
          accessibilityLabel="Public link"
          value={isPublic}
          disabled={visibility.isPending}
          onValueChange={(v) => visibility.mutate(v)}
          trackColor={{ true: colors.accent }}
        />
      </View>

      <Button
        title="Share link"
        variant="secondary"
        icon={<Ionicons name="share-outline" size={18} color={colors.fg} />}
        onPress={shareLink}
      />

      <PeopleWithAccess mediaId={media.id} />
    </View>
  )
}

function PeopleWithAccess({ mediaId }: { mediaId: string }) {
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const shares = useQuery(mediaSharesQuery(mediaId))
  const [email, setEmail] = useState('')

  const refresh = () => queryClient.invalidateQueries({ queryKey: mediaKeys.shares(mediaId) })
  const share = useMutation({
    mutationFn: () => mediaApi.share(mediaId, email.trim()),
    onSuccess: () => {
      setEmail('')
      void refresh()
    },
  })
  const unshare = useMutation({
    mutationFn: (userId: string) => mediaApi.unshare(mediaId, userId),
    onSuccess: () => void refresh(),
  })

  return (
    <View style={[styles.people, { borderTopColor: colors.border }]}>
      <Text style={{ color: colors.fg, fontWeight: '600' }}>Share with people</Text>
      <View style={styles.inputRow}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="name@example.com"
          placeholderTextColor={colors.fgSubtle}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="send"
          onSubmitEditing={() => email.trim() && share.mutate()}
          accessibilityLabel="Email to share with"
          style={[
            styles.input,
            { color: colors.fg, borderColor: colors.border, backgroundColor: colors.bg },
          ]}
        />
        <Button
          title="Share"
          disabled={!email.trim()}
          loading={share.isPending}
          onPress={() => share.mutate()}
        />
      </View>
      {share.isError && (
        <Text style={{ color: colors.danger, fontSize: 13 }}>{share.error.message}</Text>
      )}

      {shares.data?.items.length === 0 && (
        <Text style={{ color: colors.fgMuted, fontSize: 13 }}>Not shared with anyone yet.</Text>
      )}
      {shares.data?.items.map(({ user }) => (
        <View key={user.id} style={styles.person}>
          <View style={[styles.avatar, { backgroundColor: colors.surface2 }]}>
            <Text style={{ color: colors.fg, fontWeight: '700' }}>
              {user.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: colors.fg, fontWeight: '500' }}>
              {user.name}
            </Text>
            <Text numberOfLines={1} style={{ color: colors.fgMuted, fontSize: 13 }}>
              {user.email}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Stop sharing with ${user.name}`}
            hitSlop={10}
            disabled={unshare.isPending}
            onPress={() => unshare.mutate(user.id)}
          >
            <Ionicons name="close-circle-outline" size={22} color={colors.fgMuted} />
          </Pressable>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  heading: { fontSize: 17, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  people: { gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.lg },
  inputRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
