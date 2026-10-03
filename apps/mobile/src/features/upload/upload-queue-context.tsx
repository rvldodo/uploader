import type { MediaVisibility } from '@media-upload/contracts'
import { type UploadGateway, UploadQueue, xhrTransport } from '@media-upload/upload-engine'
import { useQueryClient } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { createContext, type ReactNode, useContext, useState, useSyncExternalStore } from 'react'
import { Alert, Linking } from 'react-native'
import { mediaApi } from '@/features/media/media-api'
import { mediaKeys } from '@/features/media/media-queries'
import { createUploadSource } from './upload-source'

/** Mobile adapter for the shared engine's control-plane port: straight to the API. */
const apiGateway: UploadGateway = {
  initiate: (input) => mediaApi.initiateUpload(input),
  complete: ({ mediaId, parts }) => mediaApi.completeUpload(mediaId, parts),
  cancel: (mediaId) => mediaApi.cancelUpload(mediaId),
}

interface UploadContextValue {
  queue: UploadQueue
  pickAndUpload: (visibility?: MediaVisibility) => Promise<void>
}

const UploadContext = createContext<UploadContextValue | null>(null)

/**
 * Same engine as the web app (packages/upload-engine): parallel multipart with
 * per-part retries. Mounted above the navigator so uploads continue while
 * the user browses.
 */
export function UploadQueueProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [queue] = useState(
    () =>
      new UploadQueue(apiGateway, xhrTransport, {
        fileConcurrency: 2,
        // Mobile networks are flakier: one more retry per part than web's default.
        task: { partConcurrency: 3, partRetries: 4, retryBaseDelayMs: 750 },
        onCompleted: () => queryClient.invalidateQueries({ queryKey: mediaKeys.lists() }),
      }),
  )

  const pickAndUpload = async (visibility: MediaVisibility = 'private') => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Photos access needed', 'Allow access to your photo library to upload.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ])
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: 20,
      // iOS: deliver JPEG/H.264 instead of HEIC/HEVC. The server can't decode
      // HEIC, and many browsers can't play HEVC.
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      quality: 1,
    })
    if (result.canceled) return

    const sources = await Promise.all(result.assets.map((asset) => createUploadSource(asset)))
    queue.add(sources, { visibility })
  }

  return (
    <UploadContext.Provider value={{ queue, pickAndUpload }}>{children}</UploadContext.Provider>
  )
}

export function useUploads() {
  const ctx = useContext(UploadContext)
  if (!ctx) throw new Error('useUploads must be used inside <UploadQueueProvider>')
  const uploads = useSyncExternalStore(ctx.queue.subscribe, ctx.queue.getSnapshot)
  return { ...ctx, uploads }
}
