import { loginRequestSchema, registerRequestSchema } from '@media-upload/contracts'
import { Hono } from 'hono'
import { toUserDto } from '../../../application/use-cases/auth/session-issuer'
import type { UseCases } from '../../../main/container'
import { requireAuth } from '../middleware/auth'
import type { AppEnv, AuthedEnv } from '../types'
import { validate } from '../validation'

export function authRoutes(useCases: UseCases) {
  const authed = new Hono<AuthedEnv>()
    .use(requireAuth)
    .get('/me', (c) => c.json(toUserDto(c.get('user'))))
    .post('/logout', async (c) => {
      await useCases.logoutUser.execute(c.get('sessionToken'))
      return c.body(null, 204)
    })

  return new Hono<AppEnv>()
    .post('/register', validate('json', registerRequestSchema), async (c) => {
      const session = await useCases.registerUser.execute({
        ...c.req.valid('json'),
        clientIp: c.get('clientIp'),
      })
      return c.json(session, 201)
    })
    .post('/login', validate('json', loginRequestSchema), async (c) => {
      const session = await useCases.loginUser.execute({
        ...c.req.valid('json'),
        clientIp: c.get('clientIp'),
      })
      return c.json(session, 200)
    })
    .route('/', authed)
}
