import { type ApiError, apiErrorSchema } from '@media-upload/contracts'
import type { z } from 'zod'

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiError['error']['code'],
    message: string,
  ) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

export interface ApiClientOptions {
  baseUrl: string
  /** Current bearer token, if signed in. */
  getToken: () => string | null
  /** Called when an authenticated request is rejected with 401 (session expired/revoked). */
  onUnauthorized: () => void
  fetch?: typeof fetch
  timeoutMs?: number
}

/**
 * Typed client for the backend API. Mobile talks to the API directly (no BFF),
 * authenticating with the session token as a Bearer header. Every response is
 * validated against the shared contracts, so API drift fails loudly here.
 */
export class ApiClient {
  private readonly fetchImpl: typeof fetch

  constructor(private readonly options: ApiClientOptions) {
    this.fetchImpl = options.fetch ?? ((...args) => fetch(...args))
  }

  async request<S extends z.ZodType>(
    path: string,
    schema: S,
    init?: RequestInit,
  ): Promise<z.infer<S>> {
    const res = await this.send(path, init)
    return schema.parse(await res.json())
  }

  async requestVoid(path: string, init?: RequestInit): Promise<void> {
    await this.send(path, init)
  }

  private async send(path: string, init: RequestInit = {}): Promise<Response> {
    const token = this.options.getToken()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 15_000)

    let res: Response
    try {
      res = await this.fetchImpl(`${this.options.baseUrl}${path}`, {
        ...init,
        signal: init.signal ?? controller.signal,
        headers: {
          accept: 'application/json',
          ...(init.body ? { 'content-type': 'application/json' } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(init.headers as Record<string, string> | undefined),
        },
      })
    } catch {
      throw new ApiRequestError(
        0,
        'INTERNAL_ERROR',
        "Can't reach the server. Check your connection.",
      )
    } finally {
      clearTimeout(timer)
    }

    if (res.ok) return res

    if (res.status === 401 && token) this.options.onUnauthorized()
    const parsed = apiErrorSchema.safeParse(await res.json().catch(() => null))
    if (parsed.success) {
      throw new ApiRequestError(res.status, parsed.data.error.code, parsed.data.error.message)
    }
    throw new ApiRequestError(res.status, 'INTERNAL_ERROR', `Unexpected response (${res.status})`)
  }
}

export const isNotFound = (err: unknown) => err instanceof ApiRequestError && err.status === 404
