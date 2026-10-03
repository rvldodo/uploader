/**
 * End-to-end smoke test against a running stack (API + worker + Postgres + storage).
 * Exercises the exact flow the browser uses: initiate → PUT bytes to signed
 * URLs → complete → poll until processed → delete.
 *
 *   pnpm --filter @media-upload/api smoke <file> [<file> ...]
 */
import { readFile, stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import type { InitiateUploadResponse, MediaDto } from '@media-upload/contracts'

const API = process.env.API_URL ?? 'http://localhost:4000'
const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
}

let token: string | null = null

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status} ${text}`)
  return (text ? JSON.parse(text) : undefined) as T
}

async function put(url: string, body: Uint8Array, contentType?: string): Promise<string> {
  const res = await fetch(url, {
    method: 'PUT',
    body,
    headers: contentType ? { 'content-type': contentType } : {},
  })
  if (!res.ok) throw new Error(`PUT failed: ${res.status} ${await res.text()}`)
  return res.headers.get('etag') ?? ''
}

async function uploadFile(path: string): Promise<void> {
  const mimeType = MIME[extname(path).toLowerCase()]
  if (!mimeType) throw new Error(`Unknown extension for ${path}`)
  const { size } = await stat(path)
  const bytes = await readFile(path)
  const started = performance.now()

  const init = await api<InitiateUploadResponse>('/v1/uploads', {
    method: 'POST',
    body: JSON.stringify({ filename: basename(path), mimeType, sizeBytes: size }),
  })
  const { instructions } = init
  console.log(`• ${basename(path)} (${size} B) → ${init.mediaId} [${instructions.strategy}]`)

  let parts: Array<{ partNumber: number; etag: string }> | undefined
  if (instructions.strategy === 'single') {
    await put(instructions.url, bytes, mimeType)
  } else {
    parts = await Promise.all(
      instructions.parts.map(async ({ partNumber, url }) => {
        const start = (partNumber - 1) * instructions.partSize
        const etag = await put(url, bytes.subarray(start, start + instructions.partSize))
        return { partNumber, etag }
      }),
    )
    console.log(`  uploaded ${parts.length} parts`)
  }

  let media = await api<MediaDto>(`/v1/uploads/${init.mediaId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ parts }),
  })
  while (media.status === 'processing') {
    await new Promise((r) => setTimeout(r, 500))
    media = await api<MediaDto>(`/v1/media/${init.mediaId}`)
  }

  const ms = Math.round(performance.now() - started)
  if (media.status !== 'ready')
    throw new Error(`Media ended as ${media.status}: ${media.failureReason}`)
  console.log(
    `  ready in ${ms} ms: ${media.width}x${media.height}` +
      (media.durationMs ? `, ${media.durationMs} ms` : ''),
  )

  const thumb = await fetch(media.thumbnailUrl as string)
  // Signed URLs are method-bound (GET), so probe with a 1-byte ranged GET rather than HEAD.
  const original = await fetch(media.url as string, { headers: { range: 'bytes=0-0' } })
  console.log(
    `  thumbnail ${thumb.status} (${(await thumb.arrayBuffer()).byteLength} B), original ${original.status}`,
  )
  if (!thumb.ok || !original.ok) throw new Error('signed URLs are not readable')

  await api(`/v1/media/${init.mediaId}`, { method: 'DELETE' })
  const gone = await fetch(`${API}/v1/media/${init.mediaId}`)
  console.log(`  deleted (GET → ${gone.status})`)
}

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('usage: smoke-test <file> [<file> ...]')
  process.exit(1)
}

// Each run signs up a throwaway user, so it never touches real accounts' files.
const session = await api<{ token: string; user: { email: string } }>('/v1/auth/register', {
  method: 'POST',
  body: JSON.stringify({
    email: `smoke-${Date.now()}@example.com`,
    password: 'smoke-test-password',
    name: 'Smoke Test',
  }),
})
token = session.token
console.log(`signed up as ${session.user.email}`)

for (const file of files) await uploadFile(file)
await api('/v1/auth/logout', { method: 'POST' })
console.log('✔ smoke test passed')
