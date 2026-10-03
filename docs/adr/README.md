# Architecture Decision Records

Short documents that capture **why** a significant decision was made, so later maintainers can
revisit it with full context instead of guessing. Format: context → decision → consequences.

| #    | Decision                                                        | Status   |
| ---- | --------------------------------------------------------------- | -------- |
| 0001 | [Direct-to-storage uploads with signed URLs](0001-direct-to-storage-uploads.md) | Accepted |
| 0002 | [Postgres-backed job queue (pg-boss)](0002-postgres-job-queue.md) | Accepted |
| 0003 | [Clean Architecture in the API](0003-clean-architecture.md)      | Accepted |
| 0004 | [TanStack Start server functions as a BFF](0004-tanstack-start-bff.md) | Accepted |
| 0005 | [Session-based authentication owned by the API](0005-authentication.md) | Accepted |
| 0006 | [Expo mobile client, direct API access, shared upload engine](0006-mobile-client.md) | Accepted |

To add one, copy the newest file, bump the number, and keep it under a page.
