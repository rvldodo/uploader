import * as SecureStore from 'expo-secure-store'

/**
 * The session token lives in the OS keychain/keystore (encrypted at rest),
 * with an in-memory copy so every API call doesn't hit native storage.
 */
const KEY = 'mediabox.session'
let current: string | null = null

export const sessionStorage = {
  get: (): string | null => current,

  async load(): Promise<string | null> {
    current = await SecureStore.getItemAsync(KEY)
    return current
  },

  async save(token: string): Promise<void> {
    current = token
    await SecureStore.setItemAsync(KEY, token)
  },

  async clear(): Promise<void> {
    current = null
    await SecureStore.deleteItemAsync(KEY)
  },
}
