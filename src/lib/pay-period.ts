/**
 * Biweekly pay period calculator.
 * Anchor: Thursday March 19, 2026 (known payday).
 * All dates are YYYY-MM-DD strings to avoid timezone issues.
 */

const PAY_ANCHOR = "2026-03-19" // Known Thursday payday
const PAY_PERIOD_DAYS = 14

export type PayPeriod = {
  start: string // YYYY-MM-DD
  end: string // YYYY-MM-DD
  label: string // "Mar 19 – Apr 1"
}

/** Parse YYYY-MM-DD to a Date at midnight UTC */
function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** Format Date as YYYY-MM-DD */
function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0]
}

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

/** Format a period label like "Mar 19 – Apr 1" or "Dec 26 – Jan 8, 2027" */
export function formatPeriodLabel(start: string, end: string): string {
  const s = parseDate(start)
  const e = parseDate(end)
  const sMonth = SHORT_MONTHS[s.getUTCMonth()]
  const eMonth = SHORT_MONTHS[e.getUTCMonth()]
  const sDay = s.getUTCDate()
  const eDay = e.getUTCDate()
  const sYear = s.getUTCFullYear()
  const eYear = e.getUTCFullYear()

  if (sYear !== eYear) {
    return `${sMonth} ${sDay}, ${sYear} – ${eMonth} ${eDay}, ${eYear}`
  }
  if (s.getUTCMonth() === e.getUTCMonth()) {
    return `${sMonth} ${sDay} – ${eDay}`
  }
  return `${sMonth} ${sDay} – ${eMonth} ${eDay}`
}

/** Get the pay period containing a given date */
export function getPayPeriodForDate(date: Date): PayPeriod {
  const anchor = parseDate(PAY_ANCHOR)
  // Use UTC day to get a clean date with no timezone shift
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const diffMs = target.getTime() - anchor.getTime()
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))

  // modulo that works for negative numbers (dates before anchor)
  let offset = diffDays % PAY_PERIOD_DAYS
  if (offset < 0) offset += PAY_PERIOD_DAYS

  const startDate = new Date(target.getTime() - offset * 24 * 60 * 60 * 1000)
  const endDate = new Date(startDate.getTime() + (PAY_PERIOD_DAYS - 1) * 24 * 60 * 60 * 1000)

  const start = toDateStr(startDate)
  const end = toDateStr(endDate)

  return { start, end, label: formatPeriodLabel(start, end) }
}

/** Get the current pay period */
export function getCurrentPayPeriod(): PayPeriod {
  return getPayPeriodForDate(new Date())
}

/** Get the previous or next pay period given a period start date */
export function getAdjacentPayPeriod(
  periodStart: string,
  direction: "prev" | "next"
): PayPeriod {
  const start = parseDate(periodStart)
  const shift = direction === "next" ? PAY_PERIOD_DAYS : -PAY_PERIOD_DAYS
  const newStart = new Date(start.getTime() + shift * 24 * 60 * 60 * 1000)
  const newEnd = new Date(newStart.getTime() + (PAY_PERIOD_DAYS - 1) * 24 * 60 * 60 * 1000)

  const s = toDateStr(newStart)
  const e = toDateStr(newEnd)
  return { start: s, end: e, label: formatPeriodLabel(s, e) }
}
