import { ALLOWED_MIME_TYPES, MAX_SIZE_BYTES } from '@media-upload/contracts'
import { type DragEvent, useId, useRef, useState } from 'react'
import { UploadIcon } from '~/components/icons'
import { cn } from '~/lib/cn'
import { formatBytes } from '~/lib/format'

const ACCEPT = [...ALLOWED_MIME_TYPES.image, ...ALLOWED_MIME_TYPES.video].join(',')

export function UploadDropzone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragDepth, setDragDepth] = useState(0)
  const isDragging = dragDepth > 0

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragDepth(0)
    if (e.dataTransfer.files.length) onFiles([...e.dataTransfer.files])
  }

  return (
    <label
      htmlFor={inputId}
      onDragEnter={(e) => {
        e.preventDefault()
        setDragDepth((d) => d + 1)
      }}
      onDragLeave={() => setDragDepth((d) => Math.max(0, d - 1))}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={cn(
        'group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors',
        'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
        isDragging
          ? 'border-accent bg-accent/5'
          : 'border-border bg-surface hover:border-fg-subtle hover:bg-surface-2/50',
      )}
    >
      <span
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full text-2xl transition-colors',
          isDragging
            ? 'bg-accent text-accent-fg'
            : 'bg-surface-2 text-fg-muted group-hover:text-fg',
        )}
      >
        <UploadIcon />
      </span>
      <div>
        <p className="font-medium">
          {isDragging ? 'Drop to upload' : 'Drag photos and videos here, or click to browse'}
        </p>
        <p className="mt-1 text-sm text-fg-muted">
          JPEG, PNG, WebP, GIF, AVIF up to {formatBytes(MAX_SIZE_BYTES.image)} · MP4, WebM, MOV, MKV
          up to {formatBytes(MAX_SIZE_BYTES.video)}
        </p>
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) onFiles([...e.target.files])
          e.target.value = '' // allow re-selecting the same file
        }}
      />
    </label>
  )
}
