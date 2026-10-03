import { eq } from 'drizzle-orm'
import { loadEnv } from '../config/env'
import { normalizeEmail } from '../domain/user/user'
import { createDatabase } from '../infrastructure/db/client'
import { mediaTable, usersTable } from '../infrastructure/db/schema'

/**
 * One-off operational script: hands media uploaded before authentication
 * existed (parked on the placeholder account by migration 0001) to a real user.
 *
 *   pnpm --filter @media-upload/api media:transfer-legacy you@example.com
 */
const LEGACY_OWNER_ID = '00000000-0000-0000-0000-00000000000a'

const email = process.argv[2]
if (!email) {
  console.error('usage: media:transfer-legacy <email of an existing account>')
  process.exit(1)
}

const env = loadEnv()
const { db, close } = createDatabase(env.DATABASE_URL, 1)
try {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normalizeEmail(email)))
  if (!user) throw new Error(`No account with email ${email}. Sign up in the web app first.`)

  const moved = await db
    .update(mediaTable)
    .set({ ownerId: user.id })
    .where(eq(mediaTable.ownerId, LEGACY_OWNER_ID))
    .returning({ id: mediaTable.id })
  await db.delete(usersTable).where(eq(usersTable.id, LEGACY_OWNER_ID))

  console.log(`Transferred ${moved.length} legacy media item(s) to ${user.email}`)
} finally {
  await close()
}
