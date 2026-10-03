import type { UserDto } from '@media-upload/contracts'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { logout } from './api/auth.functions'
import { authKeys, currentUserQuery } from './api/auth.queries'

/** The signed-in user (or null). Data is preloaded by the root route's beforeLoad. */
export function useCurrentUser(): UserDto | null {
  return useSuspenseQuery(currentUserQuery()).data
}

/** Applies a login/logout to every cache layer so the UI updates everywhere at once. */
export function useAuthTransitions() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const navigate = useNavigate()

  return {
    async signedIn(user: UserDto, redirectTo: string) {
      // Another user's cached data must never leak into this session.
      queryClient.clear()
      queryClient.setQueryData(authKeys.currentUser, user)
      await router.invalidate()
      await navigate({ to: redirectTo })
    },
    async signOut() {
      await logout()
      queryClient.clear()
      queryClient.setQueryData(authKeys.currentUser, null)
      await router.invalidate()
      await navigate({ to: '/login' })
    },
  }
}
