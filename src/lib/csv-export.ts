/**
 * Client-side CSV export utility.
 * Converts an array of objects to CSV and triggers browser download.
 */

function escapeCSV(value: unknown): string {
  if (value == null) return ""
  const str = String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function downloadCSV(
  rows: Record<string, unknown>[],
  filename: string,
  columns?: { key: string; label: string }[]
) {
  if (rows.length === 0) return false

  const cols = columns ?? Object.keys(rows[0]).map((k) => ({ key: k, label: k }))
  const header = cols.map((c) => escapeCSV(c.label)).join(",")
  const body = rows
    .map((row) => cols.map((c) => escapeCSV(row[c.key])).join(","))
    .join("\n")

  const csv = header + "\n" + body
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return true
}
