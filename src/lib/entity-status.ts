/**
 * Entity Status Display Config
 *
 * Centralizes status labels, badge colors, and lock logic so every page
 * that shows a status (list, detail, review queue) is consistent.
 *
 * SETUP: replace the example statuses below with your entity's state machine.
 * Match the keys exactly to what's stored in your database.
 *
 * Pattern from RFM sales app — generalized for reuse.
 */

// ── Config: replace with your statuses ───────────────────────────

/** Human-readable labels for each status value */
export const STATUS_LABELS: Record<string, string> = {
  draft:      "Draft",
  submitted:  "Submitted",
  in_review:  "In Review",
  approved:   "Approved",
  rejected:   "Rejected",
  archived:   "Archived",
}

/** shadcn Badge variant per status */
export const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft:      "secondary",
  submitted:  "default",
  in_review:  "default",
  approved:   "default",
  rejected:   "destructive",
  archived:   "outline",
}

/**
 * Tailwind color classes per status.
 * Applied as className on Badge to give each status a distinct color.
 * Both light and dark mode variants included.
 */
export const STATUS_COLORS: Record<string, string> = {
  draft:      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  submitted:  "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  in_review:  "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  approved:   "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected:   "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  archived:   "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
}

/**
 * Statuses where the record is locked (read-only).
 * Used to disable form editing and show a lock banner.
 */
export const LOCKED_STATUSES = ["submitted", "in_review", "approved", "archived"]

/**
 * Lock banner messages — shown when a record is not editable.
 * Tells the user why, not just that it's locked.
 */
export const STATUS_LOCK_LABELS: Record<string, string> = {
  submitted:  "submitted for review",
  in_review:  "currently under review",
  approved:   "approved and locked",
  archived:   "archived",
}

// ── Helpers ──────────────────────────────────────────────────────

/** Get display label for a status, falling back to a formatted version of the raw value */
export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ")
}

/** Whether a record with this status should be read-only */
export function isLocked(status: string): boolean {
  return LOCKED_STATUSES.includes(status)
}

/** Get lock banner message */
export function getLockLabel(status: string): string {
  return STATUS_LOCK_LABELS[status] ?? "locked"
}
