import type {
  ApiError,
  AuthSessionResponse,
  InitiateUploadResponse,
  MediaDto,
} from '@media-upload/contracts'
import { pino } from 'pino'
import { describe, expect, it } from 'vitest'
import { createHttpApp } from '../src/interface/http/app'
import { createTestHarness } from './fakes/test-harness'

function setup() {
  const h = createTestHarness()
  const app = createHttpApp({
    useCases: h.useCases,
    logger: pino({ level: 'silent' }),
    readinessChecks: { database: async () => {} },
  })
  return { ...h, app }
}

const send = (method: string, body?: unknown, token?: string) => ({
  method,
  headers: {
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  },
  body: body === undefined ? undefined : JSON.stringify(body),
})

async function register(app: ReturnType<typeof setup>['app'], name: string) {
  const res = await app.request(
    '/v1/auth/register',
    send('POST', { email: `${name}@example.com`, password: 'correct horse battery', name }),
  )
  expect(res.status).toBe(201)
  return (await res.json()) as AuthSessionResponse
}

describe('HTTP API: auth', () => {
  it('register → me → logout → me is 401', async () => {
    const { app } = setup()
    const { token, user } = await register(app, 'alice')

    const me = await app.request('/v1/auth/me', send('GET', undefined, token))
    expect(await me.json()).toEqual(user)

    expect((await app.request('/v1/auth/logout', send('POST', undefined, token))).status).toBe(204)
    const after = await app.request('/v1/auth/me', send('GET', undefined, token))
    expect(after.status).toBe(401)
    expect(((await after.json()) as ApiError).error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 401 for bad credentials and 409 for a taken email', async () => {
    const { app } = setup()
    await register(app, 'alice')
    const bad = await app.request(
      '/v1/auth/login',
      send('POST', { email: 'alice@example.com', password: 'x' }),
    )
    expect(bad.status).toBe(401)

    const dup = await app.request(
      '/v1/auth/register',
      send('POST', { email: 'alice@example.com', password: 'correct horse battery', name: 'A' }),
    )
    expect(dup.status).toBe(409)
  })

  it('returns 429 with Retry-After when rate limited', async () => {
    const { app } = setup()
    await register(app, 'alice')
    let res: Response | undefined
    for (let i = 0; i < 11; i++) {
      res = await app.request(
        '/v1/auth/login',
        send('POST', { email: 'alice@example.com', password: 'bad' }),
      )
    }
    expect(res?.status).toBe(429)
    expect(Number(res?.headers.get('retry-after'))).toBeGreaterThan(0)
  })
})

describe('HTTP API: media', () => {
  it('requires authentication for uploads and listing', async () => {
    const { app } = setup()
    const upload = await app.request(
      '/v1/uploads',
      send('POST', { filename: 'a.png', mimeType: 'image/png', sizeBytes: 1 }),
    )
    expect(upload.status).toBe(401)
    expect((await app.request('/v1/media')).status).toBe(401)
  })

  it('POST /v1/uploads returns upload instructions for a signed-in user', async () => {
    const { app } = setup()
    const { token } = await register(app, 'alice')
    const res = await app.request(
      '/v1/uploads',
      send('POST', { filename: 'a.png', mimeType: 'image/png', sizeBytes: 100 }, token),
    )
    expect(res.status).toBe(201)
    expect(((await res.json()) as InitiateUploadResponse).instructions.strategy).toBe('single')
  })

  it('maps validation and domain errors to their status codes', async () => {
    const { app } = setup()
    const { token } = await register(app, 'alice')

    const invalid = await app.request(
      '/v1/uploads',
      send('POST', { filename: '', sizeBytes: -1 }, token),
    )
    expect(invalid.status).toBe(400)
    expect(((await invalid.json()) as ApiError).error.details).toHaveLength(3)

    const unsupported = await app.request(
      '/v1/uploads',
      send(
        'POST',
        { filename: 'a.exe', mimeType: 'application/x-msdownload', sizeBytes: 100 },
        token,
      ),
    )
    expect(unsupported.status).toBe(415)

    const missing = await app.request('/v1/media/00000000-0000-4000-8000-00000000ffff')
    expect(missing.status).toBe(404)
  })

  it('serves public media anonymously, private media only to the owner, and 403s viewers on manage', async () => {
    const h = setup()
    const alice = await register(h.app, 'alice')
    const bob = await register(h.app, 'bob')
    const id = await h.uploadReady({ userId: alice.user.id })

    expect((await h.app.request(`/v1/media/${id}`)).status).toBe(404)

    const patch = await h.app.request(
      `/v1/media/${id}`,
      send('PATCH', { visibility: 'public' }, alice.token),
    )
    expect(((await patch.json()) as MediaDto).visibility).toBe('public')

    const anon = await h.app.request(`/v1/media/${id}`)
    expect(anon.status).toBe(200)
    expect(((await anon.json()) as MediaDto).viewerRole).toBe('viewer')

    // A stale/invalid token on a public route degrades to anonymous instead of failing.
    expect((await h.app.request(`/v1/media/${id}`, send('GET', undefined, 'stale'))).status).toBe(
      200,
    )

    const del = await h.app.request(`/v1/media/${id}`, send('DELETE', undefined, bob.token))
    expect(del.status).toBe(403)
  })

  it('shares and unshares through the API', async () => {
    const h = setup()
    const alice = await register(h.app, 'alice')
    const bob = await register(h.app, 'bob')
    const id = await h.uploadReady({ userId: alice.user.id })

    const share = await h.app.request(
      `/v1/media/${id}/shares`,
      send('POST', { email: 'bob@example.com' }, alice.token),
    )
    expect(share.status).toBe(201)
    expect((await h.app.request(`/v1/media/${id}`, send('GET', undefined, bob.token))).status).toBe(
      200,
    )

    const shared = await h.app.request('/v1/media?scope=shared', send('GET', undefined, bob.token))
    expect(((await shared.json()) as { items: MediaDto[] }).items).toHaveLength(1)

    const del = await h.app.request(
      `/v1/media/${id}/shares/${bob.user.id}`,
      send('DELETE', undefined, alice.token),
    )
    expect(del.status).toBe(204)
    expect((await h.app.request(`/v1/media/${id}`, send('GET', undefined, bob.token))).status).toBe(
      404,
    )
  })

  it('exposes health endpoints', async () => {
    const { app } = setup()
    expect((await app.request('/healthz')).status).toBe(200)
    expect(await (await app.request('/readyz')).json()).toEqual({
      status: 'ok',
      checks: { database: 'ok' },
    })
  })
})
