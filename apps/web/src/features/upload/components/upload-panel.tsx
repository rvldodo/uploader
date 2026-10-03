import type { MediaVisibility } from '@media-upload/contracts'
import { isTerminal } from '@media-upload/upload-engine'
import { useState } from 'react'
import { Button } from '~/components/button'
import { useUploadQueue } from '../hooks/upload-queue-context'
import { UploadDropzone } from './upload-dropzone'
import { UploadItem } from './upload-item'

export function UploadPanel() {
  const { queue, uploads } = useUploadQueue()
  const [visibility, setVisibility] = useState<MediaVisibility>('private')
  const finished = uploads.filter((u) => isTerminal(u.status)).length
  const active = uploads.length - finished

  return (
    <section aria-labelledby="upload-heading" className="space-y-4">
      <h2 id="upload-heading" className="sr-only">
        Upload
      </h2>
      <UploadDropzone onFiles={(files) => queue.add(files, { visibility })} />
      <div className="flex items-center justify-end gap-2 text-sm">
        <label htmlFor="upload-visibility" className="text-fg-muted">
          New uploads are
        </label>
        <select
          id="upload-visibility"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as MediaVisibility)}
          className="h-8 rounded-lg border border-border bg-surface px-2 text-sm font-medium"
        >
          <option value="private">Private</option>
          <option value="public">Public (anyone with the link)</option>
        </select>
      </div>

      {uploads.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-sm font-medium">
              {active > 0 ? `Uploading ${active} file${active === 1 ? '' : 's'}` : 'Uploads'}
            </p>
            {finished > 0 && (
              <Button size="sm" variant="ghost" onClick={() => queue.clearFinished()}>
                Clear finished
              </Button>
            )}
          </div>
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {uploads.map((upload) => (
              <UploadItem
                key={upload.id}
                upload={upload}
                onCancel={() => queue.cancel(upload.id)}
                onRetry={() => queue.retry(upload.id)}
                onDismiss={() => queue.dismiss(upload.id)}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
