# Development guide

## Setup

See the [README quick start](../README.md#quick-start). The local stack:

| Service  | URL                                   | Credentials                    |
| -------- | ------------------------------------- | ------------------------------ |
| Web      | http://localhost:3000                 | none                           |
| API      | http://localhost:4000                 | none                           |
| Postgres | `postgres://media:media@localhost:5433/media` | (host port 5433 avoids clashing with a local Postgres; override with `POSTGRES_HOST_PORT`) |
| RustFS   | S3 API http://localhost:9000, console http://localhost:9001 | `media-dev` / `media-dev-secret` |

Open http://localhost:3000 and **create an account** on the sign-up page. Every page except
login/register and public media links requires a session.

All configuration is environment variables, validated at startup by
`apps/api/src/config/env.ts`. A bad value crashes the process with a readable message.
`apps/api/.env.example` documents every variable.

## Mobile app

The Expo app lives in `apps/mobile` (SDK 57, Expo Router, routes in `src/app/`). It runs in
**Expo Go**: every native module it uses ships with Expo Go, so no native build is needed during
development.

```bash
cp apps/mobile/.env.example apps/mobile/.env
pnpm mobile          # press i for the iOS simulator, a for the Android emulator, or scan the QR code
```

| Where the app runs | `EXPO_PUBLIC_API_URL` (apps/mobile/.env) | `S3_PUBLIC_ENDPOINT` (apps/api/.env) |
| ------------------ | ---------------------------------------- | ------------------------------------- |
| iOS simulator      | `http://localhost:4000`                  | `http://localhost:9000` (default)     |
| Android emulator   | `http://10.0.2.2:4000`                   | `http://10.0.2.2:9000`                |
| Physical phone     | `http://<LAN-IP>:4000`                   | `http://<LAN-IP>:9000`                |

`S3_PUBLIC_ENDPOINT` is baked into signed URLs, so it must be reachable from the device that
downloads or uploads the file. A LAN IP works for the web app on the same machine too. Find it with
`ipconfig getifaddr en0` (macOS). Restart the API after changing it. The simulator's photo library
starts empty: add test media with `xcrun simctl addmedia booted photo.jpg clip.mp4`, or drag files
onto the simulator window.

**Conventions**

- Add native packages with `npx expo install <pkg>` (it picks SDK-compatible versions), never a plain
  `pnpm add`. Then run `pnpm --filter @media-upload/mobile doctor`.
- Screens go in `src/app/`. Everything else goes in `src/features/*` or `src/lib/`.
- All API access goes through `lib/api.ts` (`ApiClient`). It adds the token, validates responses
  against the contracts, and signs out on 401.
- Colors only come from `useTheme()`.
- Don't wrap a `Pressable` that has a function `style` in `<Link asChild>`: the function style is
  dropped and the element collapses to 0×0. Use `router.push` in `onPress` instead (see `media-tile.tsx`).

**Verifying a change**: `pnpm --filter @media-upload/mobile typecheck && pnpm --filter @media-upload/mobile test`,
then `npx expo export --platform ios` (from `apps/mobile`) to prove Metro can bundle the app,
including the workspace packages.

**Release builds** use EAS (`npx eas-cli@latest build`). The `ios/` and `android/` folders are
generated (Continuous Native Generation): configure native behavior in `app.json`, never by
editing them.

## Conventions

**General**

- TypeScript strict mode with `noUncheckedIndexedAccess`. Don't silence the compiler with `any`.
- Biome formats and lints (`pnpm format`). Single quotes, no semicolons, 100 columns.
- File names are `kebab-case`. One main export per file, named after the file.
- Comments explain **why**, not what. Public ports and use cases get a short doc comment.

**Backend**

- **Dependency rule**: `domain` ← `application` ← `infrastructure` / `interface` ← `main`. If you
  are importing `drizzle-orm`, `@aws-sdk/*`, `pg-boss` or `hono` outside `infrastructure`,
  `interface` or `main`, stop and add a port instead.
- Business rules go in the `Media` aggregate or a use case, never in a route handler. Route
  handlers only validate input, call one use case, and serialize the result.
- Throw `DomainError` subclasses for expected failures. `interface/http/middleware/error-handler.ts`
  is the **only** place that maps errors to status codes.
- Every write goes through `repo.update(media)`, which enforces optimistic concurrency.
- **Never load media for a user with `repo.findById`.** Use `MediaAccessGuard.requireViewable` or
  `requireOwned`, which enforce the access rules and turn "can't see it" into 404. Use cases that
  act for a user take an `Actor` (or `Viewer` for anonymous-capable reads) as the first argument.
- Routes that need a user go under `requireAuth` and read `c.get('viewer')`. Only anonymous-capable
  routes (currently `GET /v1/media/:id`) sit outside it.
- Job handlers must be **idempotent**: assume every job can be delivered twice.

**Frontend**

- Server-only code lives in `*.server.ts`. TanStack Start's import protection fails the build if
  client code imports it.
- Server functions live in `*.functions.ts`. They are thin: validate with a contracts schema, call
  `backendRequest`, done. `backendRequest` attaches the session automatically, so never handle the
  token yourself, and never return it to the client.
- Pages that require login go under `routes/_app/`. The layout's `beforeLoad` redirects signed-out
  users. Read the user with `useCurrentUser()`.
- Data fetching goes through `queryOptions` factories in `features/*/api/*.queries.ts`. Route
  loaders `ensure…Data` with the same options, so SSR and client share one cache entry.
- Query keys only come from the `mediaKeys` factory. Invalidate broadly (`mediaKeys.lists()`), not by
  hand-written arrays.
- Use the semantic color tokens (`bg-surface`, `text-fg-muted`, …) from `styles/app.css`. Never use
  raw palette colors, otherwise dark mode breaks.

**Contracts**

- Any change to request/response shapes starts in `packages/contracts`. Both apps fail typecheck
  until they are updated, which is the point.
- Changes must be backwards compatible (add optional fields; don't rename or remove) unless the API
  and web are deployed together.

## Recipes

### Add an API endpoint

1. Add request/response schemas to `packages/contracts/src/schemas.ts`.
2. Write the use case in `apps/api/src/application/use-cases/` and depend on ports, not adapters.
3. Register it in `createUseCases` (`apps/api/src/main/container.ts`).
4. Add the route in `apps/api/src/interface/http/routes/` using `validate('json' | 'query' | 'param', schema)`.
5. Test the use case with the harness (`test/fakes/test-harness.ts`). Add an HTTP test only if
   routing or error mapping is non-trivial.
6. Expose it to the browser with a server function in `apps/web/src/features/*/api/*.functions.ts`.

### Add an authenticated, owner-only action

1. Use case: `async execute(actor: Actor, input)` → `const media = await this.guard.requireOwned(input.mediaId, actor)`.
2. Route: put it in the `authed` sub-app in `media.routes.ts` and pass `c.get('viewer')`.
3. Tests: add a case to `test/access-and-sharing.test.ts` proving a non-owner gets 404/403.

### Change the database schema

1. Edit `apps/api/src/infrastructure/db/schema.ts` (and `MediaSnapshot` if the aggregate changes).
2. `pnpm --filter @media-upload/api db:generate --name describe_change` and review the SQL in
   `apps/api/drizzle/`.
3. `pnpm --filter @media-upload/api db:migrate`. Migrations run automatically in Docker (`setup` service).
4. Keep migrations **expand → migrate → contract** for zero-downtime deploys: add nullable columns
   first, backfill, and only later make them required or drop old ones.

### Add a background job

1. Add a queue name to `QUEUES` and create the queue in `infrastructure/queue/pg-boss.ts` with its
   retry policy.
2. Write the use case (idempotent).
3. Register a handler in `interface/jobs/register-workers.ts`.

### Support a new file type

Edit `ALLOWED_MIME_TYPES` / `MAX_SIZE_BYTES` in `packages/contracts/src/media-policy.ts`. The client
dropzone, client-side rejection and server validation all follow. If the type needs a different
decoder, extend `SharpFfmpegMediaAnalyzer`.

## Testing strategy

| Level        | Where                                   | Runs against                       | Command                     |
| ------------ | --------------------------------------- | ---------------------------------- | --------------------------- |
| Domain       | `apps/api/src/domain/**/*.test.ts`      | Pure functions/classes             | `pnpm test`                 |
| Use cases    | `apps/api/test/upload-flow.test.ts`     | Real use cases + in-memory fakes   | `pnpm test`                 |
| Auth         | `apps/api/test/auth.test.ts`            | Register/login/sessions/rate limits | `pnpm test`                |
| Access rules | `apps/api/test/access-and-sharing.test.ts`, `src/domain/media/media-access.test.ts` | Ownership, visibility, sharing | `pnpm test` |
| Security adapters | `apps/api/src/infrastructure/security/*.test.ts` | Real scrypt + token generator | `pnpm test`   |
| HTTP         | `apps/api/test/http.test.ts`            | Hono `app.request()`, no socket    | `pnpm test`                 |
| Upload engine| `packages/upload-engine/src/*.test.ts`  | Fake gateway/transport (shared by web & mobile) | `pnpm test` |
| Mobile       | `apps/mobile/src/**/*.test.ts`          | API client, upload-source adapter  | `pnpm test`                 |
| End-to-end   | `apps/api/scripts/smoke-test.ts`        | Running stack (Postgres, storage, worker, ffmpeg) | `pnpm --filter @media-upload/api smoke <files…>` |

The harness (`test/fakes/test-harness.ts`) has `signUp(name)` and `uploadReady(actor, file)` helpers
for setting up multi-user scenarios in one line each.

The fakes (`InMemoryMediaRepository`, `FakeObjectStorage`, `in-memory-auth.ts`) mirror the real adapters' semantics,
including optimistic concurrency. Keep them in sync when you change a port.

Generate test media with ffmpeg:

```bash
ffmpeg -f lavfi -i testsrc2=size=1280x720 -frames:v 1 photo.jpg
ffmpeg -f lavfi -i testsrc2=size=640x360:rate=30 -t 4 -pix_fmt yuv420p clip.mp4
# ~400 MB file to exercise multipart:
ffmpeg -f lavfi -i "nullsrc=size=1920x1080:rate=30,geq=random(1)*255:128:128" -t 4 \
  -c:v libx264 -preset ultrafast -crf 0 -pix_fmt yuv420p big.mp4
```

## Troubleshooting

| Symptom                                                    | Cause / fix                                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `Bind for 0.0.0.0:5433 failed: port is already allocated`  | Set `POSTGRES_HOST_PORT=5434` and update `DATABASE_URL`                      |
| Upload fails: "did not expose the ETag header"             | Bucket CORS is missing `ExposeHeaders: ETag`. Rerun `pnpm setup`             |
| Browser shows CORS errors on PUT                           | Your origin isn't in `STORAGE_CORS_ORIGINS`. Update it and rerun `pnpm setup`|
| Media stuck in `processing`                                | Is the worker running? Check its logs. Is `ffmpeg` on PATH (`FFMPEG_PATH`)?  |
| Signed URLs point to `storage:9000` in the browser         | Set `S3_PUBLIC_ENDPOINT` to a host the browser can reach                     |
| "Upload link expired" on huge files over slow links        | Increase `UPLOAD_URL_TTL_SECONDS` (default 1 h)                              |
| pnpm skips sharp/esbuild install scripts                   | They must be listed under `allowBuilds` in `pnpm-workspace.yaml`             |
| Logged out right after logging in (production)             | The cookie is `Secure` in production: serve the web app over HTTPS           |
| `429 RATE_LIMITED` while testing login                     | Limits are in memory: restart the API, or wait for `Retry-After`             |
| Everyone shares one rate-limit bucket                      | `TRUST_PROXY` is off, so the API sees the BFF's IP. Enable it when the API is only reachable through the BFF |
| Mobile: "Can't reach the server"                           | Wrong `EXPO_PUBLIC_API_URL` for your device (see the Mobile app table); restart `pnpm mobile` after editing `.env` |
| Mobile: grid loads but thumbnails/videos don't             | Signed URLs point at `localhost:9000`, which a phone can't reach. Set `S3_PUBLIC_ENDPOINT` to your LAN IP |
| Mobile: "File type image/heic is not supported"            | Only if the picker's Compatible mode was removed. iOS must deliver JPEG/H.264 |
| Metro: "Port 8081 is being used"                           | Another React Native project is running. Use `pnpm mobile --port 8090` |
| `403 Forbidden` calling `/_serverFn/…` with curl           | TanStack Start's CSRF check: send same-origin `Origin` / `Sec-Fetch-Site` headers, or call the API directly |

## Upgrading an existing database to authentication

Migration `0001_auth_and_sharing` adds `media.owner_id`. Files uploaded before accounts existed
can't have a real owner, so the migration parks them on a placeholder account
(`legacy-owner@invalid`) that can't log in. Nothing is deleted. To hand them to a real user:

```bash
# 1. sign up in the web app, then:
pnpm --filter @media-upload/api media:transfer-legacy you@example.com
```

## Deploying

- Build the images (`apps/api/Dockerfile`, `apps/web/Dockerfile`). The API image runs three roles:
  `node dist/server.js`, `node dist/worker.js`, and the one-shot
  `node dist/migrate.js && node dist/init-storage.js`.
- Run migrations as a pre-deploy job. Run ≥ 2 API and web replicas behind a load balancer. Scale
  workers on queue depth.
- In production, provision the bucket (CORS + lifecycle rule) with IaC that mirrors
  `main/init-storage.ts` instead of running that script.
- Set `TRUST_PROXY=true` only if the API is reachable solely through the web tier. Serve the web
  app over HTTPS, because the session cookie is `Secure` in production.
- Point the S3 variables at AWS S3 (set `S3_FORCE_PATH_STYLE=false`, leave `S3_ENDPOINT` unset) or
  any S3-compatible provider.
