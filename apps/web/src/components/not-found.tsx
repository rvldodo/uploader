import { Link } from '@tanstack/react-router'

export function NotFound({ message = 'This page does not exist.' }: { message?: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
      <p className="text-5xl font-semibold text-fg-subtle">404</p>
      <p className="text-fg-muted">{message}</p>
      <Link to="/" className="text-sm font-medium text-accent hover:underline">
        Back to library
      </Link>
    </div>
  )
}
