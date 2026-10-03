import type { Actor } from '../../src/application/actor'
import type { MediaAnalysis, MediaAnalyzer } from '../../src/application/ports/media-analyzer'
import type { Logger } from '../../src/application/ports/system'
import { InMemoryRateLimiter } from '../../src/infrastructure/security/in-memory-rate-limiter'
import { createUseCases } from '../../src/main/container'
import { FakeObjectStorage } from './fake-object-storage'
import {
  fakeHasher,
  fakeTokens,
  InMemoryMediaShareRepository,
  InMemorySessionRepository,
  InMemoryUserRepository,
} from './in-memory-auth'
import { InMemoryMediaRepository } from './in-memory-media-repository'

const MiB = 1024 * 1024
export const SESSION_TTL_SECONDS = 30 * 24 * 3600

export const silentLogger: Logger = { info() {}, warn() {}, error() {} }

/** Wires real use cases to in-memory adapters. */
export function createTestHarness() {
  let time = new Date('2026-01-01T00:00:00Z').getTime()
  let idCounter = 0

  const shares = new InMemoryMediaShareRepository()
  const repo = new InMemoryMediaRepository(shares)
  const users = new InMemoryUserRepository()
  const sessions = new InMemorySessionRepository()
  const storage = new FakeObjectStorage()
  const enqueued: string[] = []
  const analyzer: MediaAnalyzer & { next: () => Promise<MediaAnalysis> } = {
    next: async () => ({
      width: 640,
      height: 480,
      durationMs: null,
      thumbnail: Buffer.from('thumb'),
    }),
    analyze() {
      return this.next()
    },
  }
  const clock = {
    now: () => new Date(time),
    advance: (ms: number) => {
      time += ms
    },
  }

  const useCases = createUseCases(
    {
      repo,
      shares,
      users,
      sessions,
      storage,
      hasher: fakeHasher,
      tokens: fakeTokens(),
      rateLimiter: new InMemoryRateLimiter(clock),
      queue: { enqueue: async (id) => void enqueued.push(id) },
      analyzer,
      clock,
      ids: { next: () => `00000000-0000-4000-8000-${String(++idCounter).padStart(12, '0')}` },
      logger: silentLogger,
    },
    {
      UPLOAD_PART_SIZE_BYTES: 16 * MiB,
      UPLOAD_URL_TTL_SECONDS: 3600,
      DOWNLOAD_URL_TTL_SECONDS: 900,
      STALE_UPLOAD_MAX_AGE_SECONDS: 24 * 3600,
      SESSION_TTL_SECONDS,
    },
  )

  /** Registers a user and returns them as an Actor plus their bearer token. */
  async function signUp(name: string): Promise<Actor & { token: string; email: string }> {
    const email = `${name.toLowerCase()}@example.com`
    const res = await useCases.registerUser.execute({
      email,
      password: 'correct horse battery',
      name,
      clientIp: `ip-${name}`,
    })
    return { userId: res.user.id, token: res.token, email }
  }

  /** Runs a file through initiate → (simulated) upload → complete → process. */
  async function uploadReady(
    actor: Actor,
    file: {
      filename?: string
      mimeType?: string
      sizeBytes?: number
      visibility?: 'private' | 'public'
    } = {},
  ) {
    const sizeBytes = file.sizeBytes ?? 10
    const init = await useCases.initiateUpload.execute(actor, {
      filename: file.filename ?? 'photo.png',
      mimeType: file.mimeType ?? 'image/png',
      sizeBytes,
      visibility: file.visibility,
    })
    storage.simulateUpload(repo.rows.get(init.mediaId)?.storageKey as string, sizeBytes)
    await useCases.completeUpload.execute(actor, { mediaId: init.mediaId })
    await useCases.processMedia.execute({ mediaId: init.mediaId })
    return init.mediaId
  }

  return {
    useCases,
    repo,
    users,
    sessions,
    shares,
    storage,
    enqueued,
    analyzer,
    clock,
    signUp,
    uploadReady,
  }
}
