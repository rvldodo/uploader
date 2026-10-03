/**
 * Only allow same-origin relative paths as post-login targets, so
 * `/login?redirect=https://evil.example` can't be used for phishing.
 */
export function safeRedirect(target: unknown, fallback = '/'): string {
  if (typeof target !== 'string') return fallback
  if (!target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\'))
    return fallback
  return target
}
