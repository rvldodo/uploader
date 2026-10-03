# ADR-0006: Expo mobile client, direct API access, shared upload engine

**Status**: Accepted

## Context

We need iOS and Android apps with feature parity: auth, library, upload, viewing, sharing. Two
questions:

1. Should mobile go through the web BFF (TanStack Start server functions) or call the API directly?
2. How much client code can web and mobile share?

## Decision

- **Expo (SDK 57) + Expo Router**, in the same pnpm monorepo (`apps/mobile`). It uses Expo's
  built-in monorepo support with isolated installs, so no custom Metro config is needed.
- **Mobile calls the API directly** with `Authorization: Bearer <token>`. The BFF exists to keep
  tokens away from browser JavaScript (httpOnly cookies) and to avoid CORS. Neither concern applies
  natively: tokens go in the OS keychain/keystore via `expo-secure-store`, and native apps aren't
  subject to CORS. Routing mobile through the BFF would add a hop and cookie handling for no benefit.
  ADR-0005 made the API secure on its own precisely so this works.
- **Extract the upload engine** into `packages/upload-engine`, used by both apps. It already depended
  only on ports. The one platform assumption (DOM `File`) became a 4-property `UploadSource`
  interface, and `DOMException` (absent in React Native) became `UploadAbortedError`. On mobile,
  `fetch(uri).blob()` yields a native-backed Blob, so `slice()` + XHR stream multi-GB videos without
  loading them into JS memory.
- Contracts (`packages/contracts`) validate requests and responses on mobile too.

## Consequences

- ✅ One implementation of multipart, retries, cancellation and progress, tested once (9 tests) and
  run on three platforms.
- ✅ API changes break web and mobile at compile time, in the same PR.
- ⚠️ The API must now be reachable by phones, not just by the BFF. In production, put it behind a
  gateway/load balancer that sets `X-Forwarded-For`, and only then enable `TRUST_PROXY`.
- ⚠️ Signed storage URLs must use a host the *device* can reach (`S3_PUBLIC_ENDPOINT`). On a physical
  phone in development, that's your machine's LAN IP, not `localhost`.
- ⚠️ Uploads run in JS, so iOS suspends them when the app is backgrounded. The per-part retry resumes
  them when the app returns, within the 1-hour URL validity. True background transfer would need a
  native `URLSession`/`WorkManager` transport behind the same `BlobTransport` port.
