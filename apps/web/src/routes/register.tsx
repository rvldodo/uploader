import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { AuthForm } from '~/features/auth/components/auth-form'
import { safeRedirect } from '~/features/auth/redirect'

export const Route = createFileRoute('/register')({
  validateSearch: z.object({ redirect: z.string().optional().catch(undefined) }),
  beforeLoad: ({ context, search }) => {
    if (context.user) throw redirect({ to: safeRedirect(search.redirect) })
  },
  head: () => ({ meta: [{ title: 'Sign up · Mediabox' }] }),
  component: RegisterPage,
})

function RegisterPage() {
  const { redirect: target } = Route.useSearch()
  return <AuthForm mode="register" redirectTo={safeRedirect(target)} />
}
