import { queryOptions } from '@tanstack/react-query'
import { getCurrentUser } from './auth.functions'

export const authKeys = {
  currentUser: ['auth', 'current-user'] as const,
}

export const currentUserQuery = () =>
  queryOptions({
    queryKey: authKeys.currentUser,
    queryFn: () => getCurrentUser(),
    // Changes only on login/logout, which update the cache explicitly.
    staleTime: 5 * 60_000,
  })
