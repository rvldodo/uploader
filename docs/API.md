# HTTP API reference

Base URL (local): `http://localhost:4000`. All bodies are JSON. Schemas live in
`packages/contracts/src/schemas.ts`. That file is the source of truth, and both the API (request
validation) and the web app (response validation) use it.

> **Clients**: browsers reach the API through the web app's server functions (BFF). The mobile app
> calls it directly with a Bearer token. In production, expose it through a gateway that sets
> `X-Forwarded-For` (see `TRUST_PROXY`).

## Authentication

Send the session token from register/login as `Authorization: Bearer <token>`.

| Route group                                           | Auth                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| `/v1/auth/register`, `/v1/auth/login`, health         | none                                                         |
| `GET /v1/media/:id`                                   | optional: public media works anonymously                    |
| everything else                                       | required → `401 UNAUTHENTICATED` without a valid token       |

An invalid or expired token on an *optional* route is treated as anonymous (it doesn't fail), so a
stale cookie never breaks a public link.

**Access rules** (enforced by `MediaAccessGuard`, see ARCHITECTURE §4):

| Viewer                    | private file | public file | manage (visibility, share, delete) |
| ------------------------- | ------------ | ----------- | ---------------------------------- |
| owner                     | ✅           | ✅          | ✅                                 |
| user it's shared with     | ✅ (ready only) | ✅       | ❌ 403                             |
| other user / anonymous    | ❌ 404       | ✅ (ready only) | ❌ 404 (can't see it at all)    |

Hidden files return **404, not 403**, so the API never confirms that a private file exists.

## Errors

Every non-2xx response has the same shape:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "requestId": "b6f27256-6043-4bbf-84b7-2c5394ccc5e0",
    "details": [{ "path": "sizeBytes", "message": "Too small: expected number to be >0" }]
  }
}
```

| HTTP | `code`                       | When                                                         |
| ---- | ---------------------------- | ------------------------------------------------------------ |
| 400  | `VALIDATION_FAILED`          | Malformed input, bad cursor, missing multipart parts, sharing with yourself |
| 401  | `UNAUTHENTICATED`            | Missing/invalid/expired token on a protected route, or wrong email/password |
| 403  | `FORBIDDEN`                  | You can view the file but aren't its owner                  |
| 404  | `NOT_FOUND`                  | Unknown id, a file you may not see, or no account for a share email |
| 409  | `CONFLICT`                   | Illegal state transition, concurrent modification, email already registered |
| 413  | `PAYLOAD_TOO_LARGE`          | Declared size exceeds the per-kind limit                     |
| 415  | `UNSUPPORTED_MEDIA_TYPE`     | MIME type not allowed                                        |
| 422  | `UPLOAD_VERIFICATION_FAILED` | Object missing in storage, or its size ≠ declared size       |
| 429  | `RATE_LIMITED`               | Too many login/register attempts; see the `Retry-After` header |
| 500  | `INTERNAL_ERROR`             | Anything unexpected (details are logged, never returned)     |

## Auth

### `POST /v1/auth/register`

```json
{ "email": "ada@example.com", "password": "at least 8 chars", "name": "Ada" }
```

`201`: `{ "user": { "id", "email", "name" }, "token": "…", "expiresAt": "…" }`. The email is
trimmed and lower-cased. `409` if it is taken. Rate limited to 10 per hour per client IP.

### `POST /v1/auth/login`

`{ "email", "password" }` → `200` with the same body as register. A wrong password and an unknown
email both get the same `401 "Invalid email or password"`, and both take the same time. Rate
limited to 10 per 15 minutes per email and 50 per 15 minutes per IP.

### `GET /v1/auth/me` / `POST /v1/auth/logout`

`me` returns the current user. `logout` deletes the session (`204`). Sessions slide: they last 30
days (`SESSION_TTL_SECONDS`) and are extended when used after the halfway point.

## Uploads

All upload endpoints require auth. The caller becomes the owner.

### `POST /v1/uploads`: initiate

```json
{ "filename": "holiday.mp4", "mimeType": "video/mp4", "sizeBytes": 389306946, "visibility": "private" }
```

`visibility` is optional and defaults to `"private"`.

`201 Created`:

```json
{
  "mediaId": "9d3ea9ce-b0da-4134-a2c4-0ec952dbc4b7",
  "expiresAt": "2026-10-03T17:45:00.000Z",
  "instructions": {
    "strategy": "multipart",
    "partSize": 16777216,
    "parts": [{ "partNumber": 1, "url": "https://storage/...&partNumber=1&X-Amz-Signature=..." }]
  }
}
```

or, for files ≤ the part size, `{ "strategy": "single", "url": "https://storage/..." }`.

How the client sends bytes:

- **single**: `PUT <url>` with the whole file and header `Content-Type: <mimeType>` (the URL is
  signed with it).
- **multipart**: for each part `n`, `PUT <url>` with bytes `[(n-1)*partSize, n*partSize)`. Read the
  `ETag` response header and keep `{partNumber, etag}`.

### `POST /v1/uploads/:id/complete`

```json
{ "parts": [{ "partNumber": 1, "etag": "\"ede3d3b6...\"" }] }
```

`parts` is required for multipart and omitted for single uploads. Returns `200` with a `MediaDto`
in status `processing`. **Idempotent**: calling it again after success returns the current state.

### `DELETE /v1/uploads/:id`: cancel

Aborts an in-progress upload and frees its storage. `204`. Calling it on an already-cancelled
upload also returns `204`. Calling it on a completed upload returns `409`.

## Media

### `GET /v1/media?scope=mine|shared&limit=24&cursor=…&kind=image|video`

Newest first. Requires auth.

- `scope=mine` (default): your own files in `processing`, `ready` or `failed` status.
- `scope=shared`: `ready` files other users shared with you.

```json
{ "items": [MediaDto, …], "nextCursor": "WyIyMDI2LTEwLTAzVDE2OjQ1OjUzLjAwMFoiLCI5ZDNl…" }
```

`nextCursor` is opaque; pass it back unchanged. `null` means this is the last page.

### `GET /v1/media/:id`

```json
{
  "id": "9d3ea9ce-b0da-4134-a2c4-0ec952dbc4b7",
  "kind": "video",
  "status": "ready",
  "visibility": "private",
  "owner": { "id": "4f1c…", "name": "Ada" },
  "viewerRole": "owner",
  "filename": "holiday.mp4",
  "mimeType": "video/mp4",
  "sizeBytes": 389306946,
  "width": 1920,
  "height": 1080,
  "durationMs": 4000,
  "failureReason": null,
  "url": "https://storage/...signed GET, valid 15 min",
  "thumbnailUrl": "https://storage/...thumbnail.webp signed GET",
  "createdAt": "2026-10-03T16:45:53.000Z",
  "updatedAt": "2026-10-03T16:46:17.000Z"
}
```

`url` and `thumbnailUrl` are `null` unless `status` is `ready`. Signed URLs are bound to `GET`
(a `HEAD` on them returns 403). `owner` never includes an email. `viewerRole` is `owner` or
`viewer`, which tells the UI whether to show management controls.

### `PATCH /v1/media/:id` (owner)

`{ "visibility": "public" | "private" }` → the updated `MediaDto`.

### `DELETE /v1/media/:id` (owner)

Deletes the record, its shares, and every object under `media/<id>/`. `204`.

## Sharing (owner only)

| Request                                 | Body                     | Response                                    |
| --------------------------------------- | ------------------------ | ------------------------------------------- |
| `GET /v1/media/:id/shares`              | none                     | `{ items: [{ user: {id,email,name}, createdAt }] }` |
| `POST /v1/media/:id/shares`             | `{ "email": "…" }`       | `201` with the share. Idempotent. `404` if no account has that email, `400` for your own email |
| `DELETE /v1/media/:id/shares/:userId`   | none                     | `204`. Idempotent                           |

Shares grant **view-only** access. Recipients can't re-share, change visibility or delete.

## Health

| Endpoint       | Purpose                                                   |
| -------------- | --------------------------------------------------------- |
| `GET /healthz` | Liveness: `200 {"status":"ok"}` while the process is up   |
| `GET /readyz`  | Readiness: checks Postgres and the bucket; `503` if either fails |

## Try it with curl

```bash
# sign up and keep the token
TOKEN=$(curl -s localhost:4000/v1/auth/register -H 'content-type: application/json' \
  -d '{"email":"me@example.com","password":"password123","name":"Me"}' | jq -r .token)
AUTH="authorization: Bearer $TOKEN"

# initiate
curl -s localhost:4000/v1/uploads -H "$AUTH" -H 'content-type: application/json' \
  -d '{"filename":"a.jpg","mimeType":"image/jpeg","sizeBytes":'$(stat -f%z a.jpg)'}' | tee /tmp/init.json

# upload bytes (single strategy)
curl -s -X PUT -H 'content-type: image/jpeg' --data-binary @a.jpg "$(jq -r .instructions.url /tmp/init.json)"

# complete
curl -s -X POST localhost:4000/v1/uploads/$(jq -r .mediaId /tmp/init.json)/complete \
  -H "$AUTH" -H 'content-type: application/json' -d '{}'
```

Or let the script do all of it, multipart included (it signs up a throwaway user):
`pnpm --filter @media-upload/api smoke ./a.jpg ./big.mp4`.
