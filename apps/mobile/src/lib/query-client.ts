import { focusManager, QueryClient } from '@tanstack/react-query'
import { AppState, Platform } from 'react-native'
import { ApiRequestError } from './api-client'

/** Retry only what can succeed on retry: network failures and server errors, never 4xx. */
const isRetryable = (err: unknown) =>
  !(err instanceof ApiRequestError) || err.status === 0 || err.status >= 500

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Signed media URLs expire after ~15 minutes; keep data reasonably fresh.
        staleTime: 30_000,
        retry: (count, err) => count < 2 && isRetryable(err),
      },
    },
  })
}

/** Refetch stale queries when the app returns to the foreground (RN has no window focus). */
export function bindAppFocus(): () => void {
  const sub = AppState.addEventListener('change', (status) => {
    if (Platform.OS !== 'web') focusManager.setFocused(status === 'active')
  })
  return () => sub.remove()
}
