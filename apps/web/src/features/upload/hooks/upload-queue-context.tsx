import { type UploadGateway, UploadQueue, xhrTransport } from '@media-upload/upload-engine'
import { useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react'
import { cancelUpload, completeUpload, initiateUpload } from '~/features/media/api/media.functions'
import { mediaKeys } from '~/features/media/api/media.queries'

/** Adapts server functions to the engine's gateway port. */
const serverFnGateway: UploadGateway = {
  initiate: (data) => initiateUpload({ data }),
  complete: (data) => completeUpload({ data }),
  cancel: async (mediaId) => {
    await cancelUpload({ data: { mediaId } })
  },
}

const UploadQueueContext = createContext<UploadQueue | null>(null)

/**
 * Mounted once at the root so uploads keep running while the user navigates
 * between pages.
 */
export function UploadQueueProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [queue] = useState(
    () =>
      new UploadQueue(serverFnGateway, xhrTransport, {
        fileConcurrency: 2,
        onCompleted: () => queryClient.invalidateQueries({ queryKey: mediaKeys.lists() }),
      }),
  )

  // Leaving the page would kill in-flight uploads; ask first.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (queue.hasActiveUploads) e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [queue])

  return <UploadQueueContext.Provider value={queue}>{children}</UploadQueueContext.Provider>
}

export function useUploadQueue() {
  const queue = useContext(UploadQueueContext)
  if (!queue) throw new Error('useUploadQueue must be used inside <UploadQueueProvider>')
  const uploads = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot)
  return { queue, uploads }
}
