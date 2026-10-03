import { describe, expect, it } from 'vitest'
import { planUpload, S3_MAX_PARTS } from './upload-plan'

const MiB = 1024 * 1024

describe('planUpload', () => {
  it('uses a single PUT for small files', () => {
    expect(planUpload(3 * MiB, 16 * MiB)).toEqual({ strategy: 'single' })
    expect(planUpload(16 * MiB, 16 * MiB)).toEqual({ strategy: 'single' })
  })

  it('splits large files into parts of the preferred size', () => {
    expect(planUpload(100 * MiB, 16 * MiB)).toEqual({
      strategy: 'multipart',
      partSize: 16 * MiB,
      partCount: 7,
    })
  })

  it('grows the part size to stay within the S3 part limit', () => {
    const plan = planUpload(200_000 * MiB, 16 * MiB)
    if (plan.strategy !== 'multipart') throw new Error('expected multipart')
    expect(plan.partCount).toBeLessThanOrEqual(S3_MAX_PARTS)
    expect(plan.partSize * plan.partCount).toBeGreaterThanOrEqual(200_000 * MiB)
  })

  it('never goes below the S3 minimum part size', () => {
    const plan = planUpload(12 * MiB, 1 * MiB)
    expect(plan).toEqual({ strategy: 'multipart', partSize: 5 * MiB, partCount: 3 })
  })
})
