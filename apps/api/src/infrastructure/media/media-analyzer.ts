import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import sharp from 'sharp'
import {
  type MediaAnalysis,
  type MediaAnalyzer,
  UnprocessableMediaError,
} from '../../application/ports/media-analyzer'
import type { MediaKind } from '../../domain/media/media'

const execFileAsync = promisify(execFile)

const THUMBNAIL_MAX_EDGE = 640
const PROCESS_TIMEOUT_MS = 2 * 60_000

export interface FfmpegConfig {
  ffmpegPath: string
  ffprobePath: string
}

/**
 * Extracts metadata and renders WebP thumbnails.
 * Images go through sharp (libvips); videos through ffprobe + ffmpeg.
 */
export class SharpFfmpegMediaAnalyzer implements MediaAnalyzer {
  constructor(private readonly config: FfmpegConfig) {}

  analyze(kind: MediaKind, filePath: string): Promise<MediaAnalysis> {
    return kind === 'image' ? this.analyzeImage(filePath) : this.analyzeVideo(filePath)
  }

  private async analyzeImage(filePath: string): Promise<MediaAnalysis> {
    try {
      const meta = await sharp(filePath).metadata()
      const thumbnail = await toThumbnail(sharp(filePath))
      // EXIF orientations 5-8 mean the stored pixels are rotated 90°.
      const rotated = (meta.orientation ?? 1) >= 5
      return {
        width: (rotated ? meta.height : meta.width) ?? null,
        height: (rotated ? meta.width : meta.height) ?? null,
        durationMs: null,
        thumbnail,
      }
    } catch (err) {
      throw new UnprocessableMediaError('File is not a valid image', { cause: err })
    }
  }

  private async analyzeVideo(filePath: string): Promise<MediaAnalysis> {
    const probe = await this.probe(filePath)
    const stream = probe.streams?.find((s) => s.codec_type === 'video')
    if (!stream?.width || !stream.height) {
      throw new UnprocessableMediaError('File does not contain a video stream')
    }

    const durationSec = Number(probe.format?.duration ?? stream.duration ?? 0)
    const rotation = Math.abs(
      Number(
        stream.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ??
          stream.tags?.rotate ??
          0,
      ),
    )
    const sideways = rotation === 90 || rotation === 270

    // Grab a frame a little into the video to avoid black intro frames.
    const seekSec = durationSec > 2 ? Math.min(1, durationSec / 2) : 0
    const frame = await this.extractFrame(filePath, seekSec)

    return {
      width: sideways ? stream.height : stream.width,
      height: sideways ? stream.width : stream.height,
      durationMs: Number.isFinite(durationSec) ? Math.round(durationSec * 1000) : null,
      thumbnail: await toThumbnail(sharp(frame)),
    }
  }

  private async probe(filePath: string): Promise<FfprobeOutput> {
    const stdout = await this.run(this.config.ffprobePath, [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath,
    ])
    return JSON.parse(stdout.toString('utf8')) as FfprobeOutput
  }

  private extractFrame(filePath: string, seekSec: number): Promise<Buffer> {
    return this.run(this.config.ffmpegPath, [
      '-v',
      'error',
      '-ss',
      seekSec.toFixed(2),
      '-i',
      filePath,
      '-frames:v',
      '1',
      '-f',
      'image2pipe',
      '-vcodec',
      'png',
      'pipe:1',
    ])
  }

  private async run(bin: string, args: string[]): Promise<Buffer> {
    try {
      const { stdout } = await execFileAsync(bin, args, {
        encoding: 'buffer',
        timeout: PROCESS_TIMEOUT_MS,
        maxBuffer: 64 * 1024 * 1024,
      })
      return stdout
    } catch (err) {
      // Missing binary or timeout is an infrastructure problem → let the job retry.
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOENT' || (err as { killed?: boolean }).killed) throw err
      // A non-zero exit means ffmpeg could not read the file → bad content.
      throw new UnprocessableMediaError('File is not a valid video', { cause: err })
    }
  }
}

function toThumbnail(image: ReturnType<typeof sharp>): Promise<Buffer> {
  return image
    .rotate() // honour EXIF orientation
    .resize(THUMBNAIL_MAX_EDGE, THUMBNAIL_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()
}

interface FfprobeOutput {
  format?: { duration?: string }
  streams?: Array<{
    codec_type?: string
    width?: number
    height?: number
    duration?: string
    tags?: { rotate?: string }
    side_data_list?: Array<{ rotation?: number }>
  }>
}
