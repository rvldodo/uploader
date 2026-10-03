import { type ComponentProps, useId } from 'react'
import { cn } from '~/lib/cn'

interface Props extends ComponentProps<'input'> {
  label: string
  error?: string
  hint?: string
}

export function TextField({ label, error, hint, className, ...props }: Props) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-10 w-full rounded-lg border bg-surface px-3 text-sm outline-none transition-colors',
          'placeholder:text-fg-subtle focus:border-accent focus:ring-2 focus:ring-accent/20',
          error ? 'border-danger' : 'border-border',
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
