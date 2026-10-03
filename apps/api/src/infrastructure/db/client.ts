import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export function createDatabase(url: string, poolSize: number) {
  const sql = postgres(url, { max: poolSize, onnotice: () => {} })
  const db = drizzle(sql, { schema })
  return { db, close: () => sql.end({ timeout: 5 }) }
}

export type Database = ReturnType<typeof createDatabase>['db']
