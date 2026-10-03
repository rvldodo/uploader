import { userDtoSchema } from '@media-upload/contracts'
import { describe, expect, it, vi } from 'vitest'
import { ApiClient, ApiRequestError } from './api-client'

const user = { id: '00000000-0000-4000-8000-000000000001', email: 'a@example.com', name: 'A' }

function setup(response: Response | Error, token: string | null = 'tok') {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response
    return response
  })
  const onUnauthorized = vi.fn()
  const client = new ApiClient({
    baseUrl: 'https://api.test',
    getToken: () => token,
    onUnauthorized,
    fetch: fetchMock as unknown as typeof fetch,
  })
  return { client, fetchMock, onUnauthorized }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('ApiClient', () => {
  it('sends the bearer token and validates the response', async () => {
    const { client, fetchMock } = setup(json(user))
    await expect(client.request('/v1/auth/me', userDtoSchema)).resolves.toEqual(user)

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.test/v1/auth/me')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok')
  })

  it('omits the auth header when signed out', async () => {
    const { client, fetchMock } = setup(json(user), null)
    await client.request('/v1/auth/me', userDtoSchema)
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect((init.headers as Record<string, string>).authorization).toBeUndefined()
  })

  it('maps API errors and signals an expired session', async () => {
    const { client, onUnauthorized } = setup(
      json({ error: { code: 'UNAUTHENTICATED', message: 'Session expired' } }, 401),
    )
    const err = await client.request('/v1/media', userDtoSchema).catch((e) => e)
    expect(err).toBeInstanceOf(ApiRequestError)
    expect(err).toMatchObject({ status: 401, code: 'UNAUTHENTICATED', message: 'Session expired' })
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('does not treat a failed login (no token yet) as an expired session', async () => {
    const { client, onUnauthorized } = setup(
      json({ error: { code: 'UNAUTHENTICATED', message: 'Invalid email or password' } }, 401),
      null,
    )
    await expect(client.requestVoid('/v1/auth/login', { method: 'POST' })).rejects.toThrow(
      'Invalid email or password',
    )
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('reports network failures in plain language', async () => {
    const { client } = setup(new TypeError('Network request failed'))
    await expect(client.requestVoid('/healthz')).rejects.toMatchObject({ status: 0 })
  })

  it('rejects responses that break the contract', async () => {
    const { client } = setup(json({ id: 'not-a-uuid' }))
    await expect(client.request('/v1/auth/me', userDtoSchema)).rejects.toThrow()
  })
})
