# ADR-0004: TanStack Start server functions as a BFF

**Status**: Accepted

## Context

The browser needs to call the API for control-plane operations. Options: expose the API publicly
(with CORS) or route calls through the web server.

## Decision

The web app's TanStack Start **server functions** are the only client of the API. Browsers call them
as type-safe RPCs, and they forward to the API's internal URL using the shared contracts. The API
response is validated with Zod on the way back. Route loaders use the same functions, so SSR renders
real data.

## Consequences

- ✅ The API isn't publicly exposed, and there is no CORS configuration for it.
- ✅ End-to-end types from contracts → API → server function → React component.
- ✅ Auth has one obvious home: session cookies in the web tier, a service credential to the API.
- ⚠️ One extra network hop for control-plane calls (not for bytes, which go to storage directly).
- ⚠️ Third-party/mobile clients would need the API exposed through a gateway later.
