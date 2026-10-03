# ADR-0001: Direct-to-storage uploads with signed URLs

**Status**: Accepted

## Context

Videos can be several gigabytes. Streaming them through the API would tie up API instances for
minutes per upload, require large request timeouts and body limits at every proxy, and make API
scaling depend on upload bandwidth instead of request rate.

## Decision

The API only handles the **control plane**: it validates the declared file, creates a record, and
returns short-lived signed URLs. The browser `PUT`s bytes straight to S3-compatible storage. Files
above 16 MiB use S3 multipart (parallel, per-part retry). On completion the API verifies the stored
object's size before accepting it.

## Consequences

- ✅ API requests are small JSON documents (1 MB body limit), and instances scale on request rate.
- ✅ Uploads get the storage provider's bandwidth and durability. Multipart enables parallelism and
  partial retry.
- ⚠️ The bucket needs CORS (incl. `ExposeHeaders: ETag`), and signed URLs must use a host the browser
  can reach (`S3_PUBLIC_ENDPOINT`).
- ⚠️ The server can't inspect bytes during upload, so validation happens in two phases: declared
  metadata up front, real content in the worker.
- ⚠️ Abandoned multipart uploads consume storage. This is mitigated by the stale-upload sweeper plus
  a bucket lifecycle rule.
