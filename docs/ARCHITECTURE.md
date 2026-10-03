# Architecture

## 1. Goals and non-goals

**Goals**

- Upload images and large videos (multi-GB) reliably from a browser, with progress, cancel and retry.
- Keep the API cheap and horizontally scalable: **it never handles file bytes**.
- Process media asynchronously (metadata + thumbnails) without blocking the user.
- Be easy to change: business rules are isolated from frameworks and vendors.
- Multi-user: accounts, private-by-default files, public links, and per-user sharing.

**Non-goals (for now)**: OAuth/SSO, email verification and password reset, teams/organizations,
edit-level sharing, transcoding to adaptive streaming (HLS/DASH),
virus scanning, and resumable uploads across page reloads. Section 12 shows where each one plugs in.

## 2. Components

| Component        | Responsibility                                                                  | Scales by                    |
| ---------------- | ------------------------------------------------------------------------------- | ---------------------------- |
| **web** (TanStack Start) | SSR UI; server functions act as a BFF that proxies control-plane calls to the API | Stateless replicas |
| **mobile** (Expo)        | iOS/Android app; calls the API directly with a Bearer token (ADR-0006)       | n/a (client)                 |
| **api** (Hono)   | Identity (users, sessions), access control, uploads, signed URLs, the library   | Stateless replicas           |
| **worker**       | Consumes `media.process` jobs: download → analyze → thumbnail → mark ready       | Replicas × `WORKER_CONCURRENCY` |
| **PostgreSQL**   | Users, sessions, media, shares (source of truth) **and** the job queue (pg-boss schema) | Vertical, then read replicas |
| **Object storage** | Originals and thumbnails, private bucket, accessed only through signed URLs    | Managed (S3/R2/GCS)          |

The browser talks to exactly two things: the **web** origin (pages + RPC) and **object storage**
(bytes, via short-lived signed URLs). The **mobile app** talks to the **API** directly (Bearer
token) and to object storage. Both clients share `packages/contracts` (API shapes) and
`packages/upload-engine` (the whole upload algorithm).

```
 Browser ──cookie──▶ Web BFF ──Bearer──┐
                                       ├──▶ API ──▶ Postgres / pg-boss ──▶ Worker
 Mobile ─────────────Bearer────────────┘
    │ └────────── signed PUT/GET ─────────────▶ Object storage ◀────────────┘
 Browser ───────── signed PUT/GET ─────────────▶
```

## 3. Upload flow

```
Browser                 Web (BFF)              API                    Storage          Worker
   │ initiateUpload()      │                     │                        │                │
   │──────────────────────▶│ POST /v1/uploads    │                        │                │
   │                       │────────────────────▶│ validate policy        │                │
   │                       │                     │ INSERT media(uploading)│                │
   │                       │                     │ CreateMultipartUpload ▶│                │
   │                       │                     │ sign part URLs (local) │                │
   │◀──────────────────────│◀────────────────────│ {mediaId, instructions}│                │
   │                                                                      │                │
   │ PUT part 1..N  (parallel ×4, retried with backoff) ─────────────────▶│                │
   │◀────────────────────────────────────────────────────────── ETag ─────│                │
   │                                                                      │                │
   │ completeUpload(parts) │ POST …/complete     │                        │                │
   │──────────────────────▶│────────────────────▶│ CompleteMultipartUpload▶                │
   │                       │                     │ HEAD object → size ok? ▶│                │
   │                       │                     │ UPDATE status=processing                │
   │                       │                     │ enqueue media.process ─────────────────▶│
   │◀──────────────────────│◀────────────────────│ MediaDto(processing)   │                │
   │                                                                      │  GET original  │
   │ (polls GET /media/:id every 2s while processing)                     │◀───────────────│
   │                                                                      │  PUT thumbnail │
   │                                                                      │◀───────────────│
   │                                                     UPDATE status=ready ◀─────────────│
```

**Strategy selection** (`apps/api/src/application/upload-plan.ts`): files ≤ 16 MiB use a single
signed `PUT`. Larger files use S3 multipart. The part size grows automatically to stay under
S3's 10,000-part limit, and never drops below the 5 MiB minimum.

**Trust boundary**: the client's claims (type, size, "I'm done") are never trusted.

1. Type and size are checked against the shared policy (`packages/contracts/src/media-policy.ts`)
   on initiate.
2. On complete, the API `HEAD`s the stored object and rejects it if the size differs from what was
   declared (`UploadVerificationError` → 422).
3. The worker decodes the actual content. A `.mp4` that isn't a video ends up `failed` with a
   readable reason.

## 4. Authentication & authorization

### Identity and sessions

```
Browser ──(form)──▶ Web server fn `login` ──▶ API POST /v1/auth/login
                                               │ verify scrypt hash (constant time)
                                               │ INSERT sessions(id = sha256(token))
          ◀── Set-Cookie: mediabox_session ◀───┘ returns {user, token}
              (httpOnly, SameSite=Lax, Secure in prod; token never reaches JS)

Browser ──(any page / RPC + cookie)──▶ Web: backendRequest()
                                        └─ Authorization: Bearer <token> ──▶ API authenticate middleware
                                                                              └─ sha256 → sessions → user
```

- **The API owns identity.** Users, password hashes, sessions and every access decision live in
  the API's domain and application layers. The web tier only holds the cookie and translates it into
  a Bearer token in one place (`server/backend-client.server.ts`). See ADR-0005.
- **Passwords**: scrypt (N=2¹⁵, r=8, p=1, 16-byte salt). Parameters are encoded in the hash, so the
  cost can be raised later without a migration. Login always runs one hash verification, even for
  unknown emails, and returns one generic error. Both measures prevent account enumeration.
- **Sessions**: 256-bit random tokens. Only their SHA-256 is stored, so a database leak can't be
  replayed. Sessions slide over 30 days, logout deletes the row, and an hourly job purges expired
  rows.
- **CSRF**: the cookie is `SameSite=Lax`, and TanStack Start rejects cross-site server-function
  calls (verified: a cross-origin POST gets 403).
- **Brute force**: login is limited per email (10/15 min) and per IP (50/15 min), register per IP
  (10/h). The BFF forwards the client IP via `X-Forwarded-For`, which the API trusts only with
  `TRUST_PROXY=true`. The limiter is in-memory per instance; see §9.
- **Redirects** after login are restricted to same-origin paths (`safeRedirect`).

### Access model

Each media item has an **owner** and a **visibility** (`private` by default, or `public`). Owners can
**share** an item with specific users (view only) through the `media_shares` table.

| Access (`resolveMediaAccess`) | Granted when                                   | Can                       |
| ----------------------------- | ---------------------------------------------- | ------------------------- |
| `owner`                       | viewer is the owner                            | everything                |
| `shared`                      | a share row exists and the item is `ready`     | view                      |
| `public`                      | visibility is public and the item is `ready`   | view, even anonymously    |
| `none`                        | anything else                                  | nothing: **404**, not 403 |

The rule is a pure function in the domain (`domain/media/media-access.ts`).
`application/media-access-guard.ts` is the only way use cases load media for a user
(`requireViewable` / `requireOwned`), so a new use case can't forget the check. Listing is scoped
in the query itself (`owner_id = me`, or a join on `media_shares`), so no "fetch then filter" can
leak rows.

### Web routing

| Route            | Guard                                                         |
| ---------------- | ------------------------------------------------------------- |
| `__root`         | `beforeLoad` resolves the current user once (React Query cached) into `context.user` |
| `/login`, `/register` | redirect away if already signed in                       |
| `_app/*` (library) | pathless layout: redirect to `/login?redirect=…` if signed out |
| `/media/$id`     | none on purpose: public links work logged out; the API decides |

On login or logout the client calls `queryClient.clear()` before anything else, so one user's
cached data can never show up for the next. The upload queue provider is keyed by user id.

## 5. Media lifecycle

```
            complete (size verified)              analyze ok
 uploading ─────────────────────────▶ processing ───────────▶ ready
     │                                     │
     │ cancel / expired (24h)              │ bad content, or retries exhausted
     ▼                                     ▼
 cancelled                               failed
```

The state machine lives in the `Media` aggregate (`apps/api/src/domain/media/media.ts`). Each
transition is a method that checks the current state, so illegal moves (e.g. completing a cancelled
upload) throw `InvalidStateError` and map to HTTP 409.

## 6. Backend structure (Clean Architecture)

```
apps/api/src
├── domain/           Entities & business rules. No I/O, no frameworks.
│   ├── errors.ts         DomainError hierarchy (mapped to HTTP in one place)
│   ├── media/            Media aggregate, access policy, storage key layout
│   └── user/             User entity, Session
├── application/      Use cases + the ports (interfaces) they need.
│   ├── actor.ts          Actor (signed-in user) / Viewer (actor or anonymous)
│   ├── media-access-guard.ts  The single gate for loading media on behalf of a user
│   ├── ports/            Repositories, ObjectStorage, queue, analyzer, PasswordHasher, RateLimiter…
│   └── use-cases/        auth/ (register, login, sessions), uploads, media, sharing, background jobs
├── infrastructure/   Adapters implementing the ports.
│   ├── db/               Drizzle schema + repositories (optimistic locking)
│   ├── security/         scrypt hasher, token generator, in-memory rate limiter
│   ├── storage/          S3 adapter (any S3-compatible store)
│   ├── queue/            pg-boss adapter
│   └── media/            sharp + ffmpeg analyzer
├── interface/        Delivery mechanisms that call use cases.
│   ├── http/             Hono app, auth middleware, routes, validation, error mapping
│   └── jobs/             Queue handlers (the job-side equivalent of routes)
└── main/             Composition roots: container, server, worker, migrate, init-storage
```

**Dependency rule**: arrows point inwards only. `domain` imports nothing (except the shared
`contracts` kernel). `application` imports `domain` and its own ports. Only `infrastructure` and
`main` know about Postgres, S3, pg-boss or ffmpeg. As a result:

- Use cases are tested end-to-end with in-memory fakes (`apps/api/test/fakes`). No containers needed.
- Swapping S3 for GCS, or pg-boss for SQS, means writing one adapter. No use case changes.

`main/container.ts → createUseCases(adapters, config)` is pure wiring. The same function builds
the production graph and the test harness.

## 7. Frontend structure

```
apps/web/src
├── routes/                 File-based routes (TanStack Router). Loaders prefetch via React Query.
├── features/
│   ├── auth/
│   │   ├── api/                     login/register/logout/getCurrentUser server fns + query
│   │   ├── components/              auth form, user menu
│   │   └── use-auth.ts              current user + login/logout cache transitions
│   ├── media/
│   │   ├── api/media.functions.ts   createServerFn RPCs (the BFF), safe to import anywhere
│   │   ├── api/media.queries.ts     queryOptions + key factory; polling while processing
│   │   └── components/              grid, card, viewer, details, sharing panel, delete
│   └── upload/
│       ├── engine/                  Framework-agnostic upload engine (pure TS, unit tested)
│       │   ├── upload-task.ts           one file: initiate → parallel parts w/ retry → complete
│       │   ├── upload-queue.ts          bounded concurrency, useSyncExternalStore-compatible store
│       │   └── xhr-transport.ts         XHR, because fetch can't report upload progress
│       ├── hooks/upload-queue-context.tsx  provider mounted at the root, so uploads survive navigation
│       └── components/              dropzone, list, item
├── server/                    Server-only (`.server.ts`, enforced by import protection)
│   ├── backend-client.server.ts     API client: cookie → Bearer, forwards client IP
│   └── session.server.ts            httpOnly session cookie helpers
└── components/, lib/               Shared UI primitives and helpers
```

- **SSR + hydration**: route loaders call `queryClient.ensure…Data`. `@tanstack/react-router-ssr-query`
  dehydrates the cache into the HTML, so the first paint has data and no client refetch is needed.
- **BFF**: the browser calls server functions, never the API directly. No CORS on the API, the API
  URL stays private, and future auth (cookies → service token) has one obvious home.
- **Upload engine ↔ React** is decoupled through ports (`UploadGateway`, `BlobTransport`). The engine
  doesn't know about React or server functions; the provider adapts them.

### Mobile app (`apps/mobile`)

```
src/
├── app/                        Expo Router (file-based) screens
│   ├── _layout.tsx                 providers + Stack with Stack.Protected auth guards
│   ├── login.tsx, register.tsx     signed-out only
│   ├── (tabs)/                     signed-in only: My files · Shared · Account
│   └── media/[id].tsx              unguarded: public files open from links/deep links (mediabox://media/<id>)
├── features/
│   ├── auth/                       SecureStore session, AuthProvider, shared login/register form
│   ├── media/                      API calls, queries (same keys as web), grid, viewer, sharing section
│   └── upload/                     picker → UploadSource adapter, UploadQueueProvider (shared engine)
├── components/                 Button, TextField, SegmentedControl, state views
└── lib/                        ApiClient (typed, contract-validated), config, theme tokens, query client
```

- **Auth**: the token is stored in the iOS Keychain / Android Keystore (`expo-secure-store`) and held
  in memory for requests. A 401 on an authenticated call signs out locally and clears the query
  cache. `Stack.Protected` swaps the navigator between signed-in and signed-out screens.
- **Uploads**: the picker's assets are adapted to `UploadSource` through a native-backed Blob, then
  queued in the same `UploadQueue` as the web app, tuned for mobile networks (3 parallel parts, 4
  retries). On iOS the picker uses the `Compatible` representation, so the app uploads JPEG/H.264
  instead of HEIC/HEVC: the server can't decode HEIC, and browsers can't play HEVC.
- **Data**: React Query with the same key factory as the web app. It refetches when the app returns
  to the foreground (`AppState` → `focusManager`) and polls while items are processing.
- **Theme**: tokens mirror the web's CSS variables, with automatic light and dark mode.

## 8. Data model

```sql
users (
  id uuid primary key, email text unique (normalized), name text,
  password_hash text,                          -- scrypt$N$r$p$salt$key
  created_at, updated_at timestamptz
)
sessions (
  id text primary key,                         -- sha256(bearer token)
  user_id uuid → users on delete cascade,
  expires_at, created_at timestamptz
)
media_shares (
  media_id uuid → media on delete cascade,
  user_id  uuid → users on delete cascade,
  created_at timestamptz,
  primary key (media_id, user_id)
)
index media_shares(user_id)                    -- "shared with me"

media (
  id                  uuid primary key,
  owner_id            uuid → users on delete cascade,
  visibility          media_visibility not null default 'private',
  kind                media_kind   not null,   -- image | video
  status              media_status not null,   -- uploading | processing | ready | failed | cancelled
  filename, mime_type text not null,
  size_bytes          bigint not null,
  storage_key         text not null,           -- media/<id>/original.<ext>
  multipart_upload_id text,                    -- open S3 multipart session, if any
  thumbnail_key       text,                    -- media/<id>/thumbnail.webp
  width, height, duration_ms integer,
  failure_reason      text,
  version             integer not null,        -- optimistic concurrency token
  created_at, updated_at timestamptz not null
)
index (owner_id, status, created_at desc, id desc)   -- "my files", keyset paginated
index (status, created_at)                           -- stale-upload sweeper
```

- **Keyset pagination** on `(created_at, id)`: stable under concurrent inserts and O(log n) at any
  depth. Cursors are opaque base64url so the scheme can change without breaking clients.
- **Optimistic locking**: `UPDATE … WHERE id = ? AND version = ?`. A race (e.g. cancel vs. complete)
  yields `ConcurrencyError` → 409 instead of a silent lost update.
- **Storage layout**: all objects of one media item share the `media/<id>/` prefix, so deletion is
  one prefix delete.

## 9. Reliability & failure handling

| Failure                                   | Handling                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| Flaky network during a part upload        | Per-part retry with exponential backoff + jitter (network / 5xx / 408 / 429 only)          |
| Signed URL expired (403)                  | Not retried. Upload fails with a clear message, and the user can retry (fresh URLs)        |
| One part fails permanently                | Sibling parts are aborted; the server-side multipart session is aborted                    |
| User closes the tab mid-upload            | `beforeunload` warning; otherwise the **stale upload sweeper** (every 15 min) cancels uploads older than 24 h and aborts their multipart sessions. A bucket lifecycle rule is the final safety net |
| `complete` response lost, client retries  | Idempotent: already `processing`/`ready` returns the current state                         |
| Job delivered twice                       | `ProcessMedia` skips anything not in `processing`; `singletonKey` dedupes enqueues         |
| Corrupt or mislabeled file                | `UnprocessableMediaError` → `failed` immediately, no retries                               |
| Storage/DB blip during processing         | Job throws → pg-boss retries (3×, exponential backoff); final attempt marks `failed`       |
| Worker crash mid-job                      | pg-boss expires the job after 15 min and redelivers it                                     |
| Process shutdown (deploy)                 | SIGTERM: stop accepting, drain in-flight HTTP/jobs (30 s), close pools                     |
| Session cookie outlives its session       | API treats the token as anonymous; the BFF clears the cookie on the next 401 |
| App backgrounded mid-upload (mobile)      | iOS suspends JS. Parts in flight fail and are retried when the app returns; uploads older than the URL TTL fail with "link expired" and can be retried from the list |
| Rate limiter with several API replicas    | Each replica counts separately (effective limit × replicas). Swap `InMemoryRateLimiter` for a Redis/Postgres adapter behind the same port when scaling out |

**Known gap**: `CompleteUpload` updates the row and then enqueues the job; these are two separate
operations. If the process dies between them, the media stays `processing` with no job. Fix: enqueue
in the same transaction (pg-boss supports `db` adapters for this), or add a sweeper for
`processing` rows older than N minutes. See ADR-0002.

## 10. Security

- Accounts and access control: see §4. Every media endpoint goes through `MediaAccessGuard`, and
  hidden items return 404.
- Private bucket. Every read and write uses **short-lived signed URLs** (upload: 1 h, download: 15 min).
- The policy (allowed MIME types, per-kind size caps) is enforced server-side. Filenames are
  sanitized (path segments and control characters stripped). Storage keys are derived from the
  UUID, never from user input.
- Content is verified by actually decoding it in the worker. `sharp`'s pixel limit guards against
  decompression bombs. ffmpeg runs with a timeout and output buffer cap.
- The API is internal (reached via the BFF), uses `secureHeaders`, has a 1 MB JSON body limit, and
  error responses never leak internals (the request id is included for correlation).

## 11. Observability

- Structured JSON logs (pino) with a `requestId` on every HTTP log line. Job logs carry `jobId`,
  `mediaId` and `attempt`.
- `GET /healthz` (liveness, no dependencies) and `GET /readyz` (Postgres + bucket reachability, 503
  when degraded).
- Next steps: OpenTelemetry tracing (pg-boss already emits OTel spans), RED metrics per route, and a
  queue depth/age alert.

## 12. Extension points

| Want to add…                | Where it goes                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| **OAuth / SSO**             | New use case `LoginWithProvider` that finds or creates a `User` and calls `SessionIssuer.issue()`. Sessions and access rules stay as they are |
| **Password reset / email verification** | `password_reset_tokens` table (hashed, short TTL) + email port; reuse `TokenGenerator` |
| **Edit-level sharing**      | Add `role` to `media_shares`, extend `MediaAccess` with `editor`, and gate specific use cases on it |
| **Public "explore" feed**   | `scope=public` in `ListMedia` with an index on `(visibility, status, created_at)`        |
| **Push instead of polling** | SSE endpoint in the API fed by `LISTEN/NOTIFY` on status changes; swap `refetchInterval` for an event source |
| **HLS transcoding**         | New `media.transcode` queue + use case; `ready` gains renditions. The `MediaAnalyzer` port pattern applies |
| **Virus scanning**          | Another step in `ProcessMedia` (or its own job) before `markReady`                                     |
| **Resumable after reload**  | Persist `{mediaId, completed parts}` in IndexedDB; add `ListParts` to the storage port                |
| **Background uploads (mobile)** | A native transport (iOS background `URLSession`, Android `WorkManager`) implementing `BlobTransport`; the engine is unchanged |
| **Push notifications ("X shared a file with you")** | `expo-notifications` + a `device_tokens` table; emit from `ShareMedia` |
| **CDN for reads**           | Put CloudFront/R2 public domain in front of thumbnails; use signed cookies instead of per-object URLs  |
