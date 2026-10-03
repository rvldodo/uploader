import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '~/components/button'
import { LogOutIcon } from '~/components/icons'
import { useAuthTransitions, useCurrentUser } from '../use-auth'

export function UserMenu() {
  const user = useCurrentUser()
  const auth = useAuthTransitions()
  const [signingOut, setSigningOut] = useState(false)

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link to="/login" className="px-3 py-1.5 text-sm font-medium text-fg-muted hover:text-fg">
          Log in
        </Link>
        <Link
          to="/register"
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent/90"
        >
          Sign up
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-2 text-sm">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold"
        >
          {user.name.charAt(0).toUpperCase()}
        </span>
        <span className="hidden font-medium sm:inline">{user.name}</span>
      </span>
      <Button
        size="sm"
        variant="ghost"
        disabled={signingOut}
        onClick={async () => {
          setSigningOut(true)
          try {
            await auth.signOut()
          } finally {
            setSigningOut(false)
          }
        }}
      >
        <LogOutIcon /> Log out
      </Button>
    </div>
  )
}
