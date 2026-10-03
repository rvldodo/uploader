import type { MediaDto, MediaVisibility } from '@media-upload/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { Button } from '~/components/button'
import { CheckIcon, GlobeIcon, LinkIcon, LockIcon, XIcon } from '~/components/icons'
import { cn } from '~/lib/cn'
import { shareMedia, unshareMedia, updateMediaVisibility } from '../api/media.functions'
import { mediaKeys, mediaSharesQuery } from '../api/media.queries'

/** Owner-only controls: who can see this file. */
export function SharingPanel({ media }: { media: MediaDto }) {
  return (
    <section
      aria-labelledby="sharing-heading"
      className="space-y-4 rounded-2xl border border-border bg-surface p-4"
    >
      <h2 id="sharing-heading" className="text-sm font-semibold">
        Sharing
      </h2>
      <VisibilityControl media={media} />
      <CopyLinkButton />
      <PeopleWithAccess mediaId={media.id} />
    </section>
  )
}

const OPTIONS: Array<{
  value: MediaVisibility
  label: string
  help: string
  icon: typeof LockIcon
}> = [
  {
    value: 'private',
    label: 'Private',
    help: 'Only you and people you share with',
    icon: LockIcon,
  },
  {
    value: 'public',
    label: 'Public',
    help: 'Anyone with the link, no login needed',
    icon: GlobeIcon,
  },
]

function VisibilityControl({ media }: { media: MediaDto }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (visibility: MediaVisibility) =>
      updateMediaVisibility({ data: { mediaId: media.id, visibility } }),
    onSuccess: (updated) => {
      queryClient.setQueryData(mediaKeys.detail(media.id), updated)
      void queryClient.invalidateQueries({ queryKey: mediaKeys.lists() })
    },
  })

  return (
    <fieldset className="space-y-2" disabled={mutation.isPending}>
      <legend className="sr-only">Visibility</legend>
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map(({ value, label, help, icon: Icon }) => {
          const selected = media.visibility === value
          return (
            <label
              key={value}
              className={cn(
                'flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-sm transition-colors',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent',
                selected ? 'border-accent bg-accent/5' : 'border-border hover:bg-surface-2',
              )}
            >
              <input
                type="radio"
                name="visibility"
                value={value}
                checked={selected}
                onChange={() => mutation.mutate(value)}
                className="sr-only"
              />
              <span className="flex items-center gap-1.5 font-medium">
                <Icon /> {label}
              </span>
              <span className="text-xs text-fg-muted">{help}</span>
            </label>
          )
        })}
      </div>
      {mutation.isError && <p className="text-xs text-danger">{mutation.error.message}</p>}
    </fieldset>
  )
}

function CopyLinkButton() {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      size="sm"
      className="w-full justify-center"
      onClick={async () => {
        await navigator.clipboard.writeText(window.location.href)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
    >
      {copied ? <CheckIcon /> : <LinkIcon />}
      {copied ? 'Link copied' : 'Copy link'}
    </Button>
  )
}

function PeopleWithAccess({ mediaId }: { mediaId: string }) {
  const queryClient = useQueryClient()
  const shares = useQuery(mediaSharesQuery(mediaId))
  const [email, setEmail] = useState('')

  const refresh = () => queryClient.invalidateQueries({ queryKey: mediaKeys.shares(mediaId) })

  const share = useMutation({
    mutationFn: (value: string) => shareMedia({ data: { mediaId, email: value } }),
    onSuccess: () => {
      setEmail('')
      void refresh()
    },
  })
  const unshare = useMutation({
    mutationFn: (userId: string) => unshareMedia({ data: { mediaId, userId } }),
    onSuccess: () => void refresh(),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (email.trim()) share.mutate(email.trim())
  }

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <form onSubmit={onSubmit} className="space-y-1.5">
        <label htmlFor="share-email" className="block text-sm font-medium">
          Share with people
        </label>
        <div className="flex gap-2">
          <input
            id="share-email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <Button
            type="submit"
            size="sm"
            variant="primary"
            disabled={share.isPending || !email.trim()}
          >
            Share
          </Button>
        </div>
        {share.isError && <p className="text-xs text-danger">{share.error.message}</p>}
      </form>

      {shares.data && shares.data.items.length > 0 ? (
        <ul className="space-y-1" aria-label="People with access">
          {shares.data.items.map(({ user }) => (
            <li key={user.id} className="flex items-center gap-2 rounded-lg px-1 py-1">
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold"
              >
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{user.name}</span>
                <span className="block truncate text-xs text-fg-muted">{user.email}</span>
              </span>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Stop sharing with ${user.name}`}
                disabled={unshare.isPending}
                onClick={() => unshare.mutate(user.id)}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        shares.isSuccess && <p className="text-xs text-fg-muted">Not shared with anyone yet.</p>
      )}
    </div>
  )
}
