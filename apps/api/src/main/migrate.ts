import { resolve } from 'node:path'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { loadEnv } from '../config/env'

/** Applies pending SQL migrations from ./drizzle. Safe to run on every deploy. */
const env = loadEnv()
const sql = postgres(env.DATABASE_URL, { max: 1, onnotice: () => {} })

try {
  await migrate(drizzle(sql), {
    // Resolved from the working directory so it works both from source (apps/api) and from the bundled image (/app).
    migrationsFolder: resolve(process.cwd(), 'drizzle'),
  })
  console.log('Migrations applied')
} finally {
  await sql.end()
}
