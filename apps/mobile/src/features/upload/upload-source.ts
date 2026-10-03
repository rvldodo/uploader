import { ALLOWED_MIME_TYPES } from '@media-upload/contracts'
import type { UploadSource } from '@media-upload/upload-engine'

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-matroska': 'mkv',
}

const MIME_BY_EXTENSION: Record<string, string> = {
  ...Object.fromEntries(Object.entries(EXTENSION_BY_MIME).map(([mime, ext]) => [ext, mime])),
  jpeg: 'image/jpeg',
  m4v: 'video/mp4',
}

const extensionOf = (name: string) => /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase()

/** Best-effort MIME type: picker metadata first, then the file extension. */
export function resolveMimeType(mimeType: string | null | undefined, fileName: string): string {
  if (mimeType) return mimeType.toLowerCase()
  const ext = extensionOf(fileName)
  return (ext && MIME_BY_EXTENSION[ext]) || 'application/octet-stream'
}

/**
 * Picker file names can be missing, or stale after iOS converts HEIC→JPEG
 * ("IMG_0001.HEIC" holding JPEG bytes). Make the extension match the content.
 */
export function normalizeFileName(
  fileName: string | null | undefined,
  mimeType: string,
  now = Date.now(),
): string {
  const ext = EXTENSION_BY_MIME[mimeType]
  const base = (
    fileName?.replace(/\.[^.]+$/, '') || `${mimeType.startsWith('video/') ? 'VID' : 'IMG'}_${now}`
  ).trim()
  if (!ext) return fileName || base
  return `${base}.${ext}`
}

export interface PickedAsset {
  uri: string
  fileName?: string | null
  mimeType?: string | null
  fileSize?: number
}

/**
 * Adapts a picked asset to the engine's UploadSource.
 *
 * `fetch(uri).blob()` gives a *native-backed* Blob in React Native: the bytes
 * stay on disk, and `slice()` plus XHR upload stream them without ever loading
 * a multi-GB video into JS memory.
 */
export async function createUploadSource(
  asset: PickedAsset,
  loadBlob: (uri: string) => Promise<Blob> = async (uri) => (await fetch(uri)).blob(),
): Promise<UploadSource> {
  const type = resolveMimeType(asset.mimeType, asset.fileName ?? asset.uri)
  const blob = await loadBlob(asset.uri)
  return {
    name: normalizeFileName(asset.fileName, type),
    size: blob.size,
    type,
    slice: (start, end) => blob.slice(start, end),
  }
}

export const PICKABLE_MIME_TYPES = [...ALLOWED_MIME_TYPES.image, ...ALLOWED_MIME_TYPES.video]
