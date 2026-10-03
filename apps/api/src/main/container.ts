import { MediaAccessGuard } from '../application/media-access-guard'
import { MediaViewFactory } from '../application/media-view'
import type { MediaAnalyzer } from '../application/ports/media-analyzer'
import type { MediaProcessingQueue } from '../application/ports/media-processing-queue'
import type { MediaRepository } from '../application/ports/media-repository'
import type { MediaShareRepository } from '../application/ports/media-share-repository'
import type { ObjectStorage } from '../application/ports/object-storage'
import type { PasswordHasher, RateLimiter, TokenGenerator } from '../application/ports/security'
import type { SessionRepository } from '../application/ports/session-repository'
import type { Clock, IdGenerator, Logger } from '../application/ports/system'
import type { UserRepository } from '../application/ports/user-repository'
import { AuthenticateSession } from '../application/use-cases/auth/authenticate-session'
import { LoginUser } from '../application/use-cases/auth/login-user'
import { LogoutUser } from '../application/use-cases/auth/logout-user'
import { PurgeExpiredSessions } from '../application/use-cases/auth/purge-expired-sessions'
import { RegisterUser } from '../application/use-cases/auth/register-user'
import { SessionIssuer } from '../application/use-cases/auth/session-issuer'
import { CancelUpload, UploadCanceller } from '../application/use-cases/cancel-upload'
import { CompleteUpload } from '../application/use-cases/complete-upload'
import { DeleteMedia } from '../application/use-cases/delete-media'
import { ExpireStaleUploads } from '../application/use-cases/expire-stale-uploads'
import { GetMedia } from '../application/use-cases/get-media'
import { InitiateUpload } from '../application/use-cases/initiate-upload'
import { ListMedia } from '../application/use-cases/list-media'
import { MarkProcessingFailed } from '../application/use-cases/mark-processing-failed'
import { ListMediaShares, ShareMedia, UnshareMedia } from '../application/use-cases/media-sharing'
import { ProcessMedia } from '../application/use-cases/process-media'
import { UpdateMediaVisibility } from '../application/use-cases/update-media-visibility'
import type { Env } from '../config/env'
import { createDatabase } from '../infrastructure/db/client'
import { DrizzleMediaRepository } from '../infrastructure/db/drizzle-media-repository'
import { DrizzleMediaShareRepository } from '../infrastructure/db/drizzle-media-share-repository'
import { DrizzleSessionRepository } from '../infrastructure/db/drizzle-session-repository'
import { DrizzleUserRepository } from '../infrastructure/db/drizzle-user-repository'
import { SharpFfmpegMediaAnalyzer } from '../infrastructure/media/media-analyzer'
import { startPgBoss } from '../infrastructure/queue/pg-boss'
import { PgBossMediaQueue } from '../infrastructure/queue/pg-boss-media-queue'
import { CryptoTokenGenerator } from '../infrastructure/security/crypto-token-generator'
import { InMemoryRateLimiter } from '../infrastructure/security/in-memory-rate-limiter'
import { ScryptPasswordHasher } from '../infrastructure/security/scrypt-password-hasher'
import { S3ObjectStorage } from '../infrastructure/storage/s3-object-storage'
import { systemClock, uuidGenerator } from '../infrastructure/system/system'

/** Everything use cases need from the outside world. Swap these for fakes in tests. */
export interface Adapters {
  repo: MediaRepository
  shares: MediaShareRepository
  users: UserRepository
  sessions: SessionRepository
  hasher: PasswordHasher
  tokens: TokenGenerator
  rateLimiter: RateLimiter
  storage: ObjectStorage
  queue: MediaProcessingQueue
  analyzer: MediaAnalyzer
  clock: Clock
  ids: IdGenerator
  logger: Logger
}

export type UseCaseConfig = Pick<
  Env,
  | 'UPLOAD_PART_SIZE_BYTES'
  | 'UPLOAD_URL_TTL_SECONDS'
  | 'DOWNLOAD_URL_TTL_SECONDS'
  | 'STALE_UPLOAD_MAX_AGE_SECONDS'
  | 'SESSION_TTL_SECONDS'
>

/** Pure wiring: adapters in, use cases out. No I/O happens here. */
export function createUseCases(a: Adapters, config: UseCaseConfig) {
  const views = new MediaViewFactory(a.storage, a.users, config.DOWNLOAD_URL_TTL_SECONDS)
  const guard = new MediaAccessGuard(a.repo, a.shares)
  const canceller = new UploadCanceller(a.repo, a.storage, a.clock)
  const sessionIssuer = new SessionIssuer(a.sessions, a.tokens, a.clock, config.SESSION_TTL_SECONDS)

  return {
    // auth
    registerUser: new RegisterUser(a.users, a.hasher, sessionIssuer, a.rateLimiter, a.ids, a.clock),
    loginUser: new LoginUser(a.users, a.hasher, sessionIssuer, a.rateLimiter),
    logoutUser: new LogoutUser(a.sessions, a.tokens),
    authenticateSession: new AuthenticateSession(
      a.sessions,
      a.users,
      a.tokens,
      a.clock,
      config.SESSION_TTL_SECONDS,
    ),
    purgeExpiredSessions: new PurgeExpiredSessions(a.sessions, a.clock, a.logger),

    // uploads & media
    initiateUpload: new InitiateUpload(a.repo, a.storage, a.ids, a.clock, {
      partSizeBytes: config.UPLOAD_PART_SIZE_BYTES,
      uploadUrlTtlSeconds: config.UPLOAD_URL_TTL_SECONDS,
    }),
    completeUpload: new CompleteUpload(a.repo, guard, a.storage, a.queue, views, a.clock),
    cancelUpload: new CancelUpload(guard, canceller),
    getMedia: new GetMedia(guard, views),
    listMedia: new ListMedia(a.repo, views),
    deleteMedia: new DeleteMedia(a.repo, guard, a.storage),
    updateMediaVisibility: new UpdateMediaVisibility(a.repo, guard, views, a.clock),

    // sharing
    shareMedia: new ShareMedia(guard, a.shares, a.users, a.clock),
    unshareMedia: new UnshareMedia(guard, a.shares),
    listMediaShares: new ListMediaShares(guard, a.shares, a.users),

    // background
    processMedia: new ProcessMedia(a.repo, a.storage, a.analyzer, a.clock, a.logger),
    markProcessingFailed: new MarkProcessingFailed(a.repo, a.clock),
    expireStaleUploads: new ExpireStaleUploads(
      a.repo,
      canceller,
      a.clock,
      a.logger,
      config.STALE_UPLOAD_MAX_AGE_SECONDS,
    ),
  }
}

export type UseCases = ReturnType<typeof createUseCases>

export function createStorage(env: Env): S3ObjectStorage {
  return new S3ObjectStorage({
    bucket: env.S3_BUCKET,
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    publicEndpoint: env.S3_PUBLIC_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  })
}

/**
 * Composition root for real processes: connects to Postgres, storage and the
 * job queue, then wires use cases. Returns a `shutdown` that releases it all.
 */
export async function createContainer(env: Env, logger: Logger, role: 'producer' | 'worker') {
  const database = createDatabase(env.DATABASE_URL, env.DATABASE_POOL_SIZE)
  const storage = createStorage(env)
  const boss = await startPgBoss({
    connectionString: env.DATABASE_URL,
    role,
    processingRetryLimit: env.PROCESSING_RETRY_LIMIT,
  })

  const useCases = createUseCases(
    {
      repo: new DrizzleMediaRepository(database.db),
      shares: new DrizzleMediaShareRepository(database.db),
      users: new DrizzleUserRepository(database.db),
      sessions: new DrizzleSessionRepository(database.db),
      hasher: new ScryptPasswordHasher(),
      tokens: new CryptoTokenGenerator(),
      rateLimiter: new InMemoryRateLimiter(systemClock),
      storage,
      queue: new PgBossMediaQueue(boss),
      analyzer: new SharpFfmpegMediaAnalyzer({
        ffmpegPath: env.FFMPEG_PATH,
        ffprobePath: env.FFPROBE_PATH,
      }),
      clock: systemClock,
      ids: uuidGenerator,
      logger,
    },
    env,
  )

  return {
    useCases,
    boss,
    database,
    storage,
    async shutdown() {
      await boss.stop({ graceful: true, timeout: 30_000 })
      await database.close()
    },
  }
}
