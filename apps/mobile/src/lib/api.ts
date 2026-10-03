import { sessionStorage } from '@/features/auth/session-storage'
import { ApiClient } from './api-client'
import { config } from './config'

type Listener = () => void
const unauthorizedListeners = new Set<Listener>()

/** Lets the auth layer react when the server says the session is gone. */
export function onSessionExpired(listener: Listener): () => void {
  unauthorizedListeners.add(listener)
  return () => unauthorizedListeners.delete(listener)
}

/** The app-wide API client. */
export const api = new ApiClient({
  baseUrl: config.apiUrl,
  getToken: sessionStorage.get,
  onUnauthorized: () => {
    for (const listener of unauthorizedListeners) listener()
  },
})
