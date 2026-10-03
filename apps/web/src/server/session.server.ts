import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'

/**
 * The browser only ever holds the session token inside an httpOnly cookie:
 * JavaScript can't read it (XSS can't steal it) and SameSite=Lax keeps other
 * sites from making authenticated POSTs with it (CSRF).
 */
const COOKIE_NAME = 'mediabox_session'

const baseOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  // Secure by default in production. COOKIE_SECURE=false only for plain-http local stacks.
  secure: (process.env.COOKIE_SECURE ?? String(process.env.NODE_ENV === 'production')) === 'true',
  path: '/',
}

export const getSessionToken = (): string | undefined => getCookie(COOKIE_NAME)

export function setSessionCookie(token: string, expiresAt: string): void {
  setCookie(COOKIE_NAME, token, { ...baseOptions, expires: new Date(expiresAt) })
}

export function clearSessionCookie(): void {
  deleteCookie(COOKIE_NAME, baseOptions)
}
