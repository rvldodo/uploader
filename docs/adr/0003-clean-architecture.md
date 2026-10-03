# ADR-0003: Clean Architecture in the API

**Status**: Accepted

## Context

The interesting logic (upload state machine, verification, idempotent processing, expiry) is
independent of whether we use Hono, Drizzle, S3 or pg-boss. Coupling it to those libraries would
make it hard to test without containers, and hard to change vendors.

## Decision

Split the API into `domain` (Media aggregate, errors), `application` (use cases + ports),
`infrastructure` (adapters) and `interface` (HTTP routes, job handlers), wired in `main/`. The
dependency rule only allows inward imports. A single `createUseCases(adapters, config)` function
wires both production and tests.

We deliberately stop short of ceremony: no DI container, no per-use-case DTO mappers when the
contract type already fits, and no repository-per-table abstraction beyond what the use cases need.

## Consequences

- ✅ The API test suite (60 tests) runs in seconds with no Docker, covering uploads, processing, auth and access rules.
- ✅ Swapping a vendor means writing one adapter.
- ✅ Errors are mapped to HTTP in one place, so responses stay consistent.
- ⚠️ More files than a "routes call the ORM" approach. New contributors should read
  `docs/ARCHITECTURE.md` §6 first.
- ⚠️ In-memory fakes must be kept semantically in sync with real adapters. The smoke test is the
  backstop.
