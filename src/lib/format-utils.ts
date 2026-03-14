/**
 * Data formatting utilities for exports, reports, and external system integrations.
 *
 * These solve common formatting edge cases that come up in every data export:
 * - ISO dates losing their value due to timezone shifts
 * - Booleans needing string representations
 * - Null/undefined needing safe fallbacks
 */

/**
 * Convert an ISO date string or date-only string to MM/DD/YYYY.
 * Handles date-only strings (YYYY-MM-DD) without timezone shift.
 *
 * @example formatDate("2026-03-14")       // "03/14/2026"
 * @example formatDate("2026-03-14T00:00") // "03/14/2026"
 * @example formatDate(null)               // ""
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return ""
  // Date-only strings: parse directly to avoid UTC → local timezone shift
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnly) return `${dateOnly[2]}/${dateOnly[3]}/${dateOnly[1]}`
  const d = new Date(value)
  if (isNaN(d.getTime())) return ""
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(d.getUTCDate()).padStart(2, "0")
  return `${mm}/${dd}/${d.getUTCFullYear()}`
}

/**
 * Format a boolean as a human-readable string.
 *
 * @example formatBool(true)  // "Yes"
 * @example formatBool(false) // "No"
 * @example formatBool(null)  // "No"
 */
export function formatBool(value: boolean | null | undefined, labels: [string, string] = ["Yes", "No"]): string {
  return value ? labels[0] : labels[1]
}

/**
 * Format a decimal ratio as a percentage string.
 *
 * @example formatPercent(0.352)  // "35.2%"
 * @example formatPercent(1)      // "100.0%"
 * @example formatPercent(null)   // ""
 */
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value == null) return ""
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * Format a number as currency.
 *
 * @example formatCurrency(1234.5)   // "$1,234.50"
 * @example formatCurrency(null)     // ""
 */
export function formatCurrency(
  value: number | null | undefined,
  currency = "USD",
  locale = "en-US"
): string {
  if (value == null) return ""
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value)
}

/**
 * Safe string coercion — returns empty string for null/undefined.
 * Use in CSV/Excel export to avoid "null" or "undefined" appearing in cells.
 */
export function safeStr(value: string | null | undefined): string {
  return value ?? ""
}

// ── Data Freshness ─────────────────────────────────────────────────
//
// Used on dashboards to show how recently a record was last updated.
// Green = fresh (< 7 days), yellow = stale (< 30 days), red = very stale (30+ days).
//
// Usage:
//   <span className={freshnessColor(row.updated_at)}>{freshnessLabel(row.updated_at)}</span>

/**
 * Tailwind text color class based on how many days ago a timestamp is.
 * Returns muted if null (never updated).
 *
 * @example freshnessColor("2026-03-13") // "text-green-500"  (1 day ago)
 * @example freshnessColor("2026-02-01") // "text-red-500"    (>30 days ago)
 * @example freshnessColor(null)         // "text-muted-foreground"
 */
export function freshnessColor(ts: string | null): string {
  if (!ts) return "text-muted-foreground"
  const days = (Date.now() - new Date(ts).getTime()) / (1000 * 60 * 60 * 24)
  if (days < 7) return "text-green-500"
  if (days < 30) return "text-yellow-500"
  return "text-red-500"
}

/**
 * Human-readable label for how long ago a timestamp was.
 * "Today", "Yesterday", "3d ago", or a short date for older entries.
 *
 * @example freshnessLabel("2026-03-14") // "Today"
 * @example freshnessLabel("2026-03-13") // "Yesterday"
 * @example freshnessLabel("2026-03-10") // "4d ago"
 * @example freshnessLabel("2026-01-01") // "Jan 1"
 * @example freshnessLabel(null)         // "Never"
 */
export function freshnessLabel(ts: string | null): string {
  if (!ts) return "Never"
  const d = new Date(ts)
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
