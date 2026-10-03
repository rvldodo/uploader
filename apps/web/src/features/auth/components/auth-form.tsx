import {
  loginRequestSchema,
  PASSWORD_MIN_LENGTH,
  registerRequestSchema,
} from '@media-upload/contracts'
import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { Button } from '~/components/button'
import { AlertIcon } from '~/components/icons'
import { TextField } from '~/components/text-field'
import { login, register } from '../api/auth.functions'
import { useAuthTransitions } from '../use-auth'

type Mode = 'login' | 'register'
type FieldErrors = Partial<Record<'name' | 'email' | 'password', string>>

export function AuthForm({ mode, redirectTo }: { mode: Mode; redirectTo: string }) {
  const isRegister = mode === 'register'
  const auth = useAuthTransitions()
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const mutation = useMutation({
    mutationFn: (values: Record<string, string>) =>
      isRegister
        ? register({ data: registerRequestSchema.parse(values) })
        : login({ data: loginRequestSchema.parse(values) }),
    onSuccess: (user) => auth.signedIn(user, redirectTo),
  })

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const values = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>

    // Same schema as the server, so users see problems before a round-trip.
    const result = (isRegister ? registerRequestSchema : loginRequestSchema).safeParse(values)
    if (!result.success) {
      const errors: FieldErrors = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FieldErrors
        errors[field] ??= issue.message
      }
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    mutation.mutate(values)
  }

  return (
    <div className="mx-auto w-full max-w-sm py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isRegister ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          {isRegister
            ? 'Upload, organize and share your photos and videos.'
            : 'Log in to your library.'}
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        noValidate
        className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm"
      >
        {mutation.isError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-danger/10 p-3 text-sm text-danger"
          >
            <AlertIcon className="mt-0.5 shrink-0" />
            {mutation.error.message}
          </div>
        )}
        {isRegister && (
          <TextField
            label="Name"
            name="name"
            autoComplete="name"
            error={fieldErrors.name}
            required
          />
        )}
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          error={fieldErrors.email}
          required
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          hint={isRegister ? `At least ${PASSWORD_MIN_LENGTH} characters` : undefined}
          error={fieldErrors.password}
          required
        />
        <Button
          type="submit"
          variant="primary"
          className="w-full justify-center"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Please wait…' : isRegister ? 'Create account' : 'Log in'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-fg-muted">
        {isRegister ? 'Already have an account? ' : 'New here? '}
        <Link
          to={isRegister ? '/login' : '/register'}
          search={redirectTo === '/' ? {} : { redirect: redirectTo }}
          className="font-medium text-accent hover:underline"
        >
          {isRegister ? 'Log in' : 'Create an account'}
        </Link>
      </p>
    </div>
  )
}
