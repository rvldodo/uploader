import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

/**
 * Pathless layout guarding every page that needs a signed-in user. Child
 * routes get a non-null `context.user`.
 */
export const Route = createFileRoute('/_app')({
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    return { user: context.user }
  },
  component: Outlet,
})
