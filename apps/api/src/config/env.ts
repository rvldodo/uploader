import { z } from 'zod'

const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1')

const MiB = 1024 * 1024

/**
 * All configuration comes from environment variables and is validated once at
 * startup. A misconfigured process crashes immediately with a readable error
 * instead of failing on the first request.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.url(),
  DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(10),

  /** Endpoint the API/worker use to reach storage (may be an internal hostname). */
  S3_ENDPOINT: z.url().optional(),
  /** Endpoint baked into signed URLs handed to browsers. Defaults to S3_ENDPOINT. */
  S3_PUBLIC_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: bool.default(true),
  /** Browser origins allowed to PUT/GET objects directly (comma separated). */
  STORAGE_CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),

  UPLOAD_PART_SIZE_BYTES: z.coerce
    .number()
    .int()
    .min(5 * MiB)
    .default(16 * MiB),
  UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  DOWNLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  STALE_UPLOAD_MAX_AGE_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(24 * 3600),

  /** Sliding session lifetime. */
  SESSION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(30 * 24 * 3600),
  /**
   * Trust the first X-Forwarded-For entry as the client IP (used for rate
   * limiting). Enable only when the API is reachable solely through a trusted
   * proxy, such as the web BFF; otherwise clients could spoof their IP.
   */
  TRUST_PROXY: bool.default(false),

  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
  PROCESSING_RETRY_LIMIT: z.coerce.number().int().min(0).default(3),
  FFMPEG_PATH: z.string().default('ffmpeg'),
  FFPROBE_PATH: z.string().default('ffprobe'),
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    console.error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`)
    process.exit(1)
  }
  return result.data
}
