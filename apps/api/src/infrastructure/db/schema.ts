import { MEDIA_KINDS, MEDIA_STATUSES, MEDIA_VISIBILITIES } from '@media-upload/contracts'
import {
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

export const usersTable = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    /** Normalized (trimmed, lower-cased) by the domain before it gets here. */
    email: text('email').notNull(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamptz('created_at').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
  },
  (t) => [uniqueIndex('users_email_key').on(t.email)],
)

export const sessionsTable = pgTable(
  'sessions',
  {
    /** SHA-256 of the bearer token. The raw token is never stored. */
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    expiresAt: timestamptz('expires_at').notNull(),
    createdAt: timestamptz('created_at').notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId), index('sessions_expires_idx').on(t.expiresAt)],
)

/* ------------------------------------------------------------------ */
/* Media                                                               */
/* ------------------------------------------------------------------ */

export const mediaKindEnum = pgEnum('media_kind', MEDIA_KINDS)
export const mediaStatusEnum = pgEnum('media_status', MEDIA_STATUSES)
export const mediaVisibilityEnum = pgEnum('media_visibility', MEDIA_VISIBILITIES)

export const mediaTable = pgTable(
  'media',
  {
    id: uuid('id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    kind: mediaKindEnum('kind').notNull(),
    status: mediaStatusEnum('status').notNull(),
    visibility: mediaVisibilityEnum('visibility').notNull().default('private'),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    storageKey: text('storage_key').notNull(),
    multipartUploadId: text('multipart_upload_id'),
    thumbnailKey: text('thumbnail_key'),
    width: integer('width'),
    height: integer('height'),
    durationMs: integer('duration_ms'),
    failureReason: text('failure_reason'),
    version: integer('version').notNull().default(0),
    createdAt: timestamptz('created_at').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
  },
  (t) => [
    // "My library": WHERE owner_id = ? AND status IN (...) [AND kind = ?] ORDER BY created_at DESC, id DESC
    index('media_owner_status_created_idx').on(
      t.ownerId,
      t.status,
      t.createdAt.desc(),
      t.id.desc(),
    ),
    // Stale-upload sweeper: WHERE status = 'uploading' AND created_at < ?
    index('media_status_created_idx').on(t.status, t.createdAt),
  ],
)

export const mediaSharesTable = pgTable(
  'media_shares',
  {
    mediaId: uuid('media_id')
      .notNull()
      .references(() => mediaTable.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    createdAt: timestamptz('created_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.mediaId, t.userId] }),
    // "Shared with me": WHERE user_id = ?
    index('media_shares_user_idx').on(t.userId),
  ],
)

export type MediaRow = typeof mediaTable.$inferSelect
export type UserRow = typeof usersTable.$inferSelect
