/// <reference types="vite/client" />
import type { QueryClient } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import type { ReactNode } from 'react'
import { currentUserQuery } from '~/features/auth/api/auth.queries'
import { UserMenu } from '~/features/auth/components/user-menu'
import { useCurrentUser } from '~/features/auth/use-auth'
import { UploadQueueProvider } from '~/features/upload/hooks/upload-queue-context'
import appCss from '~/styles/app.css?url'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Resolve the session once per navigation (cached by React Query) and expose
  // it to every route's beforeLoad/loader as `context.user`.
  beforeLoad: async ({ context }) => ({
    user: await context.queryClient.ensureQueryData(currentUserQuery()),
  }),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Mediabox — Upload photos & videos' },
      { name: 'description', content: 'Upload, process and browse images and videos.' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        {import.meta.env.DEV && (
          <>
            <TanStackRouterDevtools position="bottom-right" />
            <ReactQueryDevtools buttonPosition="bottom-left" />
          </>
        )}
        <Scripts />
      </body>
    </html>
  )
}

function RootLayout() {
  const user = useCurrentUser()
  return (
    // Keyed by user: signing out (or switching accounts) discards the upload queue.
    <UploadQueueProvider key={user?.id ?? 'anonymous'}>
      <div className="min-h-dvh">
        <header className="sticky top-0 z-10 border-b border-border bg-bg/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-sm text-accent-fg">
                M
              </span>
              Mediabox
            </Link>
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <Outlet />
        </main>
      </div>
    </UploadQueueProvider>
  )
}
