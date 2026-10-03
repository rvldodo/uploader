import type { Actor, Viewer } from '../../application/actor'
import type { User } from '../../domain/user/user'
import type { AppLogger } from '../../infrastructure/logger'

/** Hono context variables available to every handler. */
export interface AppEnv {
  Variables: {
    requestId: string
    logger: AppLogger
    /** Authenticated user, or null for anonymous requests. Set by `authenticate`. */
    viewer: Viewer
    user: User | null
    /** Raw bearer token of the current request, if any (needed for logout). */
    sessionToken: string | null
    clientIp: string
  }
}

/** Context after `requireAuth`: the viewer is guaranteed to be present. */
export interface AuthedEnv extends AppEnv {
  Variables: AppEnv['Variables'] & { viewer: Actor; user: User; sessionToken: string }
}
