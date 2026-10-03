/**
 * Build-time configuration (EXPO_PUBLIC_* vars are inlined by the bundler).
 * See .env.example for values per device type.
 */
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing ${name}. Copy apps/mobile/.env.example to .env.`)
  return value.replace(/\/+$/, '')
}

export const config = {
  apiUrl: required('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL),
  webUrl: required('EXPO_PUBLIC_WEB_URL', process.env.EXPO_PUBLIC_WEB_URL),
}
