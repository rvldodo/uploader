# ADR-0002: Postgres-backed job queue (pg-boss)

**Status**: Accepted

## Context

Processing (ffprobe/ffmpeg, sharp) is slow and must run outside the request path, with retries and
scheduled work (the stale-upload sweep). Options: Redis + BullMQ, a cloud queue (SQS/PubSub), or a
queue in the Postgres we already run.

## Decision

Use **pg-boss**. Queues live in a `pgboss` schema in the same database. Jobs carry only the media id
(the database row is the source of truth). Retries use exponential backoff, `singletonKey`
deduplicates, and cron schedules are coordinated across instances.

## Consequences

- ✅ No new infrastructure to run, secure, back up or monitor.
- ✅ Jobs are as durable as the data. Enqueueing could be made transactional with the state change
  (pg-boss supports custom db adapters). Today it is two calls, documented as a known gap.
- ⚠️ Throughput tops out around thousands of jobs/s, which is far above what video processing needs.
  If that changes, `MediaProcessingQueue` is a port: write an SQS adapter and keep the use cases.
- ⚠️ Polling adds latency (configured to 1 s). LISTEN/NOTIFY can reduce it if needed.
