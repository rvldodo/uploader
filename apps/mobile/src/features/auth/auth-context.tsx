import type { AuthSessionResponse, UserDto } from '@media-upload/contracts'
import { useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { onSessionExpired } from '@/lib/api'
import { ApiRequestError } from '@/lib/api-client'
import { authApi } from './auth-api'
import { sessionStorage } from './session-storage'

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'signedOut'; user: null }
  | { status: 'signedIn'; user: UserDto }

interface AuthContextValue {
  state: AuthState
  login: typeof authApi.login
  register: typeof authApi.register
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null })

  const signOutLocally = useCallback(async () => {
    await sessionStorage.clear()
    // Never let one user's cached data leak into the next session.
    queryClient.clear()
    setState({ status: 'signedOut', user: null })
  }, [queryClient])

  // Restore the session on launch.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = await sessionStorage.load()
      if (!token) return !cancelled && setState({ status: 'signedOut', user: null })
      try {
        const user = await authApi.me()
        if (!cancelled) setState({ status: 'signedIn', user })
      } catch (err) {
        // Offline at launch: keep the token and stay signed out of the UI only if it was rejected.
        if (err instanceof ApiRequestError && err.status === 401) await sessionStorage.clear()
        if (!cancelled) setState({ status: 'signedOut', user: null })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => onSessionExpired(() => void signOutLocally()), [signOutLocally])

  const establish = useCallback(
    async (session: AuthSessionResponse) => {
      await sessionStorage.save(session.token)
      queryClient.clear()
      setState({ status: 'signedIn', user: session.user })
      return session
    },
    [queryClient],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      login: async (body) => establish(await authApi.login(body)),
      register: async (body) => establish(await authApi.register(body)),
      logout: async () => {
        try {
          await authApi.logout()
        } catch {
          // Revoking server-side is best effort; local sign-out always happens.
        }
        await signOutLocally()
      },
    }),
    [state, establish, signOutLocally],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** For screens that only render when signed in. */
export function useCurrentUser(): UserDto {
  const { state } = useAuth()
  if (state.status !== 'signedIn') throw new Error('useCurrentUser requires a signed-in user')
  return state.user
}
