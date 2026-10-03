import {
  listMediaQuerySchema,
  mediaIdSchema,
  shareMediaRequestSchema,
  updateMediaRequestSchema,
  userIdSchema,
} from '@media-upload/contracts'
import { Hono } from 'hono'
import { z } from 'zod'
import type { UseCases } from '../../../main/container'
import { requireAuth } from '../middleware/auth'
import type { AppEnv, AuthedEnv } from '../types'
import { validate } from '../validation'

const idParam = z.object({ id: mediaIdSchema })
const shareParam = z.object({ id: mediaIdSchema, userId: userIdSchema })

export function mediaRoutes(useCases: UseCases) {
  const authed = new Hono<AuthedEnv>()
    .use(requireAuth)
    .get('/', validate('query', listMediaQuerySchema), async (c) => {
      return c.json(await useCases.listMedia.execute(c.get('viewer'), c.req.valid('query')))
    })
    .patch(
      '/:id',
      validate('param', idParam),
      validate('json', updateMediaRequestSchema),
      async (c) => {
        const media = await useCases.updateMediaVisibility.execute(c.get('viewer'), {
          mediaId: c.req.valid('param').id,
          visibility: c.req.valid('json').visibility,
        })
        return c.json(media)
      },
    )
    .delete('/:id', validate('param', idParam), async (c) => {
      await useCases.deleteMedia.execute(c.get('viewer'), { mediaId: c.req.valid('param').id })
      return c.body(null, 204)
    })
    .get('/:id/shares', validate('param', idParam), async (c) => {
      return c.json(
        await useCases.listMediaShares.execute(c.get('viewer'), {
          mediaId: c.req.valid('param').id,
        }),
      )
    })
    .post(
      '/:id/shares',
      validate('param', idParam),
      validate('json', shareMediaRequestSchema),
      async (c) => {
        const share = await useCases.shareMedia.execute(c.get('viewer'), {
          mediaId: c.req.valid('param').id,
          email: c.req.valid('json').email,
        })
        return c.json(share, 201)
      },
    )
    .delete('/:id/shares/:userId', validate('param', shareParam), async (c) => {
      const { id, userId } = c.req.valid('param')
      await useCases.unshareMedia.execute(c.get('viewer'), { mediaId: id, userId })
      return c.body(null, 204)
    })

  return (
    new Hono<AppEnv>()
      // Public media must be viewable without logging in, so this one stays outside requireAuth.
      .get('/:id', validate('param', idParam), async (c) => {
        return c.json(
          await useCases.getMedia.execute(c.get('viewer'), { mediaId: c.req.valid('param').id }),
        )
      })
      .route('/', authed)
  )
}
