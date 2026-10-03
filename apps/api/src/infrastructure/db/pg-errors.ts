/** Postgres unique_violation (SQLSTATE 23505), as surfaced by postgres.js / drizzle. */
export function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err; e; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: string }).code === '23505') return true
  }
  return false
}
