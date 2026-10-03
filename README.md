# Mediabox: image & video uploads

A production-shaped reference implementation for uploading, processing and sharing images and
videos. Files of any size (up to 5 GB by default) go **directly from the browser to object
storage** via signed URLs. A background worker extracts metadata and renders thumbnails.

- **Accounts**: email + password sign-up and login, with httpOnly session cookies.
- **Your own library**: every file has an owner. Files are **private** by default, or **public** so
  anyone with the link can view them, even logged out.
- **Sharing**: share a file with specific users by email (view-only). They see it under
  "Shared with me".
- **iOS & Android app** with the same features, built on the same upload engine as the web app.

| Layer          | Tech                                                                     |
| -------------- | ------------------------------------------------------------------------ |
| Frontend / BFF | **TanStack Start** (React 19, TanStack Router + Query, SSR), Tailwind v4 |
| Mobile         | **Expo SDK 57** (React Native, Expo Router, expo-video, expo-image, SecureStore) |
| API            | Node 22+, **Hono**, Zod, Clean Architecture (domain / application / infra) |
| Persistence    | PostgreSQL 17 + Drizzle ORM                                              |
| Jobs           | **pg-boss** (Postgres-backed queue, so no extra infrastructure)          |
| Storage        | Any S3-compatible store (RustFS locally; AWS S3 / R2 / GCS in prod)      |
| Processing     | sharp (images), ffprobe + ffmpeg (video)                                 |
| Tooling        | pnpm workspaces, TypeScript (strict), Vitest, Biome                      |

```
┌──────────┐  server fns (RPC)  ┌──────────────┐   REST    ┌─────────┐   jobs   ┌────────┐
│ Browser  │ ─────────────────▶ │ TanStack     │ ────────▶ │   API   │ ───────▶ │ Worker │
│          │                    │ Start (BFF)  │           │ (Hono)  │ pg-boss  │        │
│          │ ── PUT bytes (signed URLs) ─────────────────────────────────┐     └───┬────┘
└──────────┘                                               │ Postgres │ │         │
                                                           └──────────┘ ▼         ▼
                                                                  ┌──────────────────┐
                                                                  │ S3-compatible    │
                                                                  │ object storage   │
                                                                  └──────────────────┘
```

## Quick start

Prerequisites: **Node ≥ 22.12**, **pnpm ≥ 10** (`corepack enable`), **Docker**, and **ffmpeg** on
your PATH (`brew install ffmpeg` / `apt install ffmpeg`).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

pnpm infra:up      # Postgres (host port 5433) + RustFS storage (9000, console on 9001)
pnpm setup         # run DB migrations + create the bucket with CORS
pnpm dev           # web on :3000, API on :4000, worker
```

Open http://localhost:3000, create an account, and drop some files in. To try sharing, sign up a
second account in a private window and share a file with its email.

**Everything in Docker** (no local Node or ffmpeg needed):

```bash
docker compose --profile app up --build
```

### Mobile app

```bash
cp apps/mobile/.env.example apps/mobile/.env   # defaults work for the iOS simulator
pnpm mobile                                    # then press i (iOS simulator) / a (Android) or scan the QR
```

The app runs in **Expo Go**, with no native build needed. On a **physical phone**, point it at your
machine's LAN IP: set `EXPO_PUBLIC_API_URL=http://<LAN-IP>:4000` in `apps/mobile/.env`, set
`S3_PUBLIC_ENDPOINT=http://<LAN-IP>:9000` in `apps/api/.env`, and restart the API.
See [DEVELOPMENT.md](docs/DEVELOPMENT.md#mobile-app).

## Common commands

| Command                                     | What it does                                        |
| ------------------------------------------- | --------------------------------------------------- |
| `pnpm dev`                                  | Web + API + worker with hot reload                  |
| `pnpm mobile`                               | Expo dev server for the mobile app                  |
| `pnpm test`                                 | All unit/integration tests (no infra needed)        |
| `pnpm typecheck`                            | Strict TypeScript across the monorepo               |
| `pnpm lint` / `pnpm format`                 | Biome lint / auto-fix                               |
| `pnpm build`                                | Production builds of every package                  |
| `pnpm --filter @media-upload/api smoke <files…>` | End-to-end test against the running stack     |
| `pnpm --filter @media-upload/api db:generate --name <x>` | Create a migration after schema changes |

## Repository layout

```
apps/
  api/          Backend: HTTP API + background worker (one codebase, two entrypoints)
  web/          TanStack Start app: UI + backend-for-frontend server functions
  mobile/       Expo (React Native) app for iOS & Android
packages/
  contracts/    Zod schemas & upload policy shared by api, web and mobile: the API contract
  upload-engine/ Framework-agnostic upload engine (multipart, retries, progress) used by web & mobile
docs/
  ARCHITECTURE.md   System design, upload flow, data model, failure handling
  API.md            HTTP API reference
  DEVELOPMENT.md    Conventions, how to add features, testing strategy, troubleshooting
  adr/              Architecture Decision Records (why things are the way they are)
```

## Documentation

Start with [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), then [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
The key decisions and their trade-offs are recorded in [docs/adr](docs/adr).
