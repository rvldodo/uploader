# ADR-0005: Session-based authentication owned by the API

**Status**: Accepted

## Context

Users need accounts, private files, public links and per-user sharing. Options:

1. A drop-in auth library in the web tier (e.g. Better Auth), with the API trusting the web tier.
2. A hosted identity provider (Auth0, Clerk, Cognito) with JWTs.
3. First-party email + password sessions, owned by the API.

The access rules (owner / shared / public, 404-not-403) are core business logic and belong in the
API's domain, next to the Media aggregate. Whichever option we pick, the API must know *who* is
calling.

## Decision

Option 3, deliberately small:

- The API stores users (scrypt hashes from Node's built-in crypto, so no native dependencies) and
  sessions keyed by **SHA-256 of a 256-bit random token**. Sessions slide over 30 days.
- The web BFF keeps the token in an **httpOnly, SameSite=Lax cookie** and forwards it as
  `Authorization: Bearer`. Browser JavaScript never sees the token.
- Opaque tokens, not JWTs: logout and revocation are immediate (delete the row), with no
  key-rotation or token-blacklist machinery. The cost is one indexed primary-key lookup per
  request.
- Authorization lives in one domain function (`resolveMediaAccess`) and one application gate
  (`MediaAccessGuard`).

## Consequences

- ✅ No third-party dependency or vendor lock-in. Everything is testable with in-memory fakes.
- ✅ The API is secure on its own (it doesn't just trust the BFF), so exposing it later to mobile
  clients only needs a token endpoint, not a redesign.
- ✅ OAuth/SSO can be added later as another way to *create a session*. Authorization doesn't change.
- ⚠️ We own password security: hashing parameters, rate limiting, timing equalization. These are
  implemented and tested, but there is no password reset or email verification yet.
- ⚠️ The in-memory rate limiter is per instance. It needs a shared store (Redis/Postgres) before
  running several API replicas.
- ⚠️ Sharing by email confirms to the *sharer* whether an address has an account. Accepted for
  UX; login itself stays non-enumerable.
