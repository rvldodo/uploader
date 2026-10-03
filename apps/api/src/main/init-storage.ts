import {
  BucketAlreadyOwnedByYou,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutBucketLifecycleConfigurationCommand,
} from '@aws-sdk/client-s3'
import { loadEnv } from '../config/env'
import { createStorage } from './container'

/**
 * Idempotently provisions the bucket for local/dev environments. In production
 * the bucket is owned by infrastructure-as-code with the same settings.
 */
const env = loadEnv()
const s3 = createStorage(env).rawClient
const Bucket = env.S3_BUCKET

try {
  await s3.send(new HeadBucketCommand({ Bucket }))
  console.log(`Bucket "${Bucket}" exists`)
} catch {
  try {
    await s3.send(new CreateBucketCommand({ Bucket }))
    console.log(`Bucket "${Bucket}" created`)
  } catch (err) {
    if (!(err instanceof BucketAlreadyOwnedByYou)) throw err
  }
}

// Browsers PUT parts directly to storage and must be able to read the ETag header.
await s3.send(
  new PutBucketCorsCommand({
    Bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: env.STORAGE_CORS_ORIGINS,
          AllowedMethods: ['GET', 'PUT', 'HEAD'],
          AllowedHeaders: ['*'],
          ExposeHeaders: ['ETag'],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }),
)
console.log(`CORS configured for: ${env.STORAGE_CORS_ORIGINS.join(', ')}`)

// Safety net behind the stale-upload sweeper: storage reclaims abandoned parts by itself.
try {
  await s3.send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket,
      LifecycleConfiguration: {
        Rules: [
          {
            ID: 'abort-incomplete-multipart-uploads',
            Status: 'Enabled',
            Filter: { Prefix: '' },
            AbortIncompleteMultipartUpload: { DaysAfterInitiation: 2 },
          },
        ],
      },
    }),
  )
  console.log('Lifecycle rule configured')
} catch (err) {
  console.warn(
    'Lifecycle rules not supported by this storage backend, skipping:',
    (err as Error).message,
  )
}
