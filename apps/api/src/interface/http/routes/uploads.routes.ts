import {
  completeUploadRequestSchema,
  initiateUploadRequestSchema,
  mediaIdSchema,
} from '@media-upload/contracts'
import { Hono } from 'hono'
import { z } from 'zod'
import type { UseCases } from '../../../main/container'
import { requireAuth } from '../middleware/auth'
import type { AuthedEnv } from '../types'
import { validate } from '../validation'

const idParam = z.object({ id: mediaIdSchema })

/** Every upload operation requires a signed-in user, who becomes the owner. */
export function uploadsRoutes(useCases: UseCases) {
  return new Hono<AuthedEnv>()
    .use(requireAuth)
    .post('/', validate('json', initiateUploadRequestSchema), async (c) => {
      const result = await useCases.initiateUpload.execute(c.get('viewer'), c.req.valid('json'))
      return c.json(result, 201)
    })
    .post(
      '/:id/complete',
      validate('param', idParam),
      validate('json', completeUploadRequestSchema),
      async (c) => {
        const media = await useCases.completeUpload.execute(c.get('viewer'), {
          mediaId: c.req.valid('param').id,
          parts: c.req.valid('json').parts,
        })
        return c.json(media, 200)
      },
    )
    .delete('/:id', validate('param', idParam), async (c) => {
      await useCases.cancelUpload.execute(c.get('viewer'), { mediaId: c.req.valid('param').id })
      return c.body(null, 204)
    })
}
