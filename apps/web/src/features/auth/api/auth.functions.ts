import {
  authSessionResponseSchema,
  loginRequestSchema,
  registerRequestSchema,
  type UserDto,
  userDtoSchema,
} from '@media-upload/contracts'
import { createServerFn } from '@tanstack/react-start'
import { BackendError, backendRequest } from '~/server/backend-client.server'
import { clearSessionCookie, getSessionToken, setSessionCookie } from '~/server/session.server'

/**
 * Auth server functions. The token returned by the API is put in an httpOnly
 * cookie here and never sent to the browser; the client only learns *who* is
 * signed in.
 */

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<UserDto | null> => {
    if (!getSessionToken()) return null
    try {
      return await backendRequest('/v1/auth/me', userDtoSchema)
    } catch (err) {
      if (err instanceof BackendError && err.status === 401) return null // cookie already cleared
      throw err
    }
  },
)

export const login = createServerFn({ method: 'POST' })
  .validator(loginRequestSchema)
  .handler(async ({ data }) => {
    const session = await backendRequest('/v1/auth/login', authSessionResponseSchema, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    setSessionCookie(session.token, session.expiresAt)
    return session.user
  })

export const register = createServerFn({ method: 'POST' })
  .validator(registerRequestSchema)
  .handler(async ({ data }) => {
    const session = await backendRequest('/v1/auth/register', authSessionResponseSchema, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    setSessionCookie(session.token, session.expiresAt)
    return session.user
  })

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  try {
    if (getSessionToken()) await backendRequest('/v1/auth/logout', null, { method: 'POST' })
  } finally {
    // Clear locally even if the API call fails: the user asked to be logged out.
    clearSessionCookie()
  }
})
