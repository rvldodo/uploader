import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '~/components/button'
import { TrashIcon } from '~/components/icons'
import { deleteMedia } from '../api/media.functions'
import { mediaKeys } from '../api/media.queries'

export function DeleteMediaButton({ mediaId }: { mediaId: string }) {
  const [confirming, setConfirming] = useState(false)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: () => deleteMedia({ data: { mediaId } }),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: mediaKeys.detail(mediaId) })
      await queryClient.invalidateQueries({ queryKey: mediaKeys.lists() })
      await navigate({ to: '/' })
    },
  })

  if (!confirming) {
    return (
      <Button
        variant="secondary"
        className="w-full justify-center"
        onClick={() => setConfirming(true)}
      >
        <TrashIcon /> Delete
      </Button>
    )
  }

  return (
    <div className="space-y-2 rounded-2xl border border-danger/30 bg-danger/5 p-3">
      <p className="text-sm">Delete this file permanently? This cannot be undone.</p>
      {mutation.isError && <p className="text-sm text-danger">{mutation.error.message}</p>}
      <div className="flex gap-2">
        <Button
          variant="danger"
          size="sm"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'Deleting…' : 'Delete'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(false)}
          disabled={mutation.isPending}
        >
          Keep
        </Button>
      </div>
    </div>
  )
}
