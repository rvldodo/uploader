import { type ApiError, apiErrorSchema } from '@media-upload/contracts'
import { getRequestIP } from '@tanstack/react-start/server'
import type { z } from 'zod'
import { clearSessionCookie, getSessionToken } from './session.server'

/**
 * Server-only HTTP client for the backend API. The `.server.ts` suffix makes
 * TanStack Start's import protection fail the build if client code imports it.
 *
 * Every call automatically carries the current user's session (from the
 * httpOnly cookie) as a Bearer token, plus the client IP for rate limiting.
 */
const API_URL = process.env.API_URL ?? 'http://localhost:4000'

export class BackendError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiError['error']['code'],
    message: string,
  ) {
    super(message)
    this.name = 'BackendError'
  }
}

export async function backendRequest<S extends z.ZodType>(
  path: string,
  schema: S,
  init?: RequestInit,
): Promise<z.infer<S>>
export async function backendRequest(path: string, schema: null, init?: RequestInit): Promise<void>
export async function backendRequest(
  path: string,
  schema: z.ZodType | null,
  init?: RequestInit,
): Promise<unknown> {
  const token = getSessionToken()
  const clientIp = getRequestIP({ xForwardedFor: true })

  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(clientIp ? { 'x-forwarded-for': clientIp } : {}),
        ...init?.headers,
      },
      signal: init?.signal ?? AbortSignal.timeout(15_000),
    })
  } catch (cause) {
    console.error('Backend unreachable', { path, cause })
    throw new BackendError(
      503,
      'INTERNAL_ERROR',
      'The media service is unavailable, try again shortly',
    )
  }

  if (!res.ok) {
    // The API rejected our session: drop the dead cookie so the UI shows "logged out".
    if (res.status === 401 && token) clearSessionCookie()

    const parsed = apiErrorSchema.safeParse(await res.json().catch(() => null))
    if (parsed.success) {
      throw new BackendError(res.status, parsed.data.error.code, parsed.data.error.message)
    }
    throw new BackendError(res.status, 'INTERNAL_ERROR', `Unexpected response (${res.status})`)
  }

  if (schema === null) return undefined
  // Validate responses too: a contract drift should fail loudly here, not deep in the UI.
  return schema.parse(await res.json())
}
