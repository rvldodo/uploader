import { ErrorComponent, type ErrorComponentProps, Link, useRouter } from '@tanstack/react-router'
import { Button } from './button'

export function DefaultCatchBoundary({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <div className="w-full text-left text-sm text-fg-muted">
        <ErrorComponent error={error} />
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => {
            reset()
            void router.invalidate()
          }}
        >
          Try again
        </Button>
        <Link
          to="/"
          className="inline-flex h-10 items-center px-4 text-sm text-fg-muted hover:text-fg"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
