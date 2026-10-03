import { Ionicons } from '@expo/vector-icons'
import type { MediaKind } from '@media-upload/contracts'
import { Stack, useNavigation } from 'expo-router'
import { useLayoutEffect, useState } from 'react'
import { ActionSheetIOS, Alert, Platform, Pressable, View } from 'react-native'
import { SegmentedControl } from '@/components/segmented-control'
import { MediaGrid } from '@/features/media/components/media-grid'
import { UploadList } from '@/features/upload/components/upload-list'
import { useUploads } from '@/features/upload/upload-queue-context'
import { spacing, useTheme } from '@/lib/theme'

type KindFilter = 'all' | MediaKind
const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Photos' },
  { value: 'video', label: 'Videos' },
] as const

export default function MyFilesScreen() {
  const { colors } = useTheme()
  const navigation = useNavigation()
  const { pickAndUpload } = useUploads()
  const [kind, setKind] = useState<KindFilter>('all')

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Upload photos or videos"
          hitSlop={10}
          onPress={() => chooseVisibility((v) => void pickAndUpload(v))}
          style={{ marginRight: spacing.lg }}
        >
          <Ionicons name="add-circle" size={28} color={colors.accent} />
        </Pressable>
      ),
    })
  }, [navigation, colors.accent, pickAndUpload])

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'My files' }} />
      <MediaGrid
        scope="mine"
        kind={kind === 'all' ? undefined : kind}
        header={
          <View>
            <UploadList />
            <View style={{ padding: spacing.md }}>
              <SegmentedControl options={FILTERS} value={kind} onChange={setKind} />
            </View>
          </View>
        }
      />
    </View>
  )
}

/** Asks how new uploads should be shared, using the platform's native picker UI. */
function chooseVisibility(onChoose: (visibility: 'private' | 'public') => void) {
  const title = 'Upload as'
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: ['Private', 'Public (anyone with the link)', 'Cancel'],
        cancelButtonIndex: 2,
      },
      (i) => {
        if (i === 0) onChoose('private')
        if (i === 1) onChoose('public')
      },
    )
  } else {
    Alert.alert(title, 'You can change this later.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Public', onPress: () => onChoose('public') },
      { text: 'Private', onPress: () => onChoose('private') },
    ])
  }
}
