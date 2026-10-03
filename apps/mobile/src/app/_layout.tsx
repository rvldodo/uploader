import { QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { LoadingView } from '@/components/state-views'
import { AuthProvider, useAuth } from '@/features/auth/auth-context'
import { UploadQueueProvider } from '@/features/upload/upload-queue-context'
import { bindAppFocus, createQueryClient } from '@/lib/query-client'
import { useTheme } from '@/lib/theme'

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient)
  useEffect(bindAppFocus, [])

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  )
}

function RootNavigator() {
  const { state } = useAuth()
  const { colors, isDark } = useTheme()
  if (state.status === 'loading') return <LoadingView />

  const signedIn = state.status === 'signedIn'
  return (
    // Keyed by user: signing out (or switching accounts) discards the upload queue.
    <UploadQueueProvider key={state.user?.id ?? 'signed-out'}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.fg },
          headerStyle: { backgroundColor: colors.surface },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        {/* Protected groups: when the guard flips, Expo Router redirects to the first available screen. */}
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen
            name="register"
            options={{ title: 'Create account', headerBackTitle: 'Log in' }}
          />
        </Stack.Protected>
        {/* Unguarded: public files open from a link even when signed out; the API decides access. */}
        <Stack.Screen name="media/[id]" options={{ title: '' }} />
      </Stack>
    </UploadQueueProvider>
  )
}
