/**
 * Escape special characters for safe use in PostgreSQL ILIKE patterns.
 * Prevents % and _ from being interpreted as wildcards.
 *
 * Usage:
 *   const escaped = escapeIlike(userInput)
 *   supabase.from("table").select("*").ilike("column", `%${escaped}%`)
 */
export function escapeIlike(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
}
