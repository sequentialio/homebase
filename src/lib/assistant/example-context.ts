/**
 * Context Builder — Example
 *
 * Fetches user data from Supabase and returns a structured plain-text
 * string that gets injected into the AI assistant's system prompt.
 *
 * WHY PLAIN TEXT:
 * Plain text is the most token-efficient format for Claude's context window.
 * JSON wastes tokens on brackets and quotes; prose loses structure.
 * The "--- SECTION ---\nkey: value" format is compact and Claude reads it well.
 *
 * SETUP:
 * 1. Copy this file and rename it (e.g. financial-context.ts, crm-context.ts)
 * 2. Replace the example queries with your domain's tables
 * 3. Import and call it in your /api/assistant/chat/route.ts
 *
 * Pattern from homebase app — generalized for reuse.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

// ── Main builder ──────────────────────────────────────────────────

export async function buildExampleContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const now = new Date()

  // Run all queries in parallel for speed
  const [profileRes, recordsRes] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", userId).single(),
    // SETUP: replace with your domain's table and relevant fields
    supabase
      .from("records")
      .select("id, name, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ])

  const profile = profileRes.data
  const records = recordsRes.data || []

  const sections: string[] = []

  // Header
  sections.push(
    `USER: ${profile?.full_name || "Unknown"}\n` +
    `DATE: ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`
  )

  // Records
  if (records.length > 0) {
    const lines = records.map((r) => `${r.name} | status: ${r.status}`)
    sections.push(`--- RECORDS (${records.length}) ---\n${lines.join("\n")}`)
  } else {
    sections.push("--- RECORDS ---\nNo records found.")
  }

  return sections.join("\n\n")
}

// ── Tips for scaling context builders ────────────────────────────
//
// 1. PARALLEL QUERIES: always wrap multiple queries in Promise.all()
//    to avoid sequential waterfall latency.
//
// 2. LIMIT ROWS: fetch only what Claude needs. 20-50 recent records
//    is usually plenty — Claude can ask for more if needed.
//
// 3. SECTION FORMAT:
//    --- SECTION NAME ---
//    row1: value | field: value
//    row2: ...
//    Summary line: total X items
//
// 4. COMPUTED SUMMARIES: calculate totals/averages in code, not in Claude.
//    "Total: $12,345" in the context costs far fewer tokens than raw rows.
//
// 5. SCOPE TAGS: if your records have personal/business scope, append
//    "[Business]" tags inline so Claude can reason about them.
//
// 6. REQUEST-TIME SNAPSHOTS: always fetch fresh data at request time.
//    Never cache context — stale data leads to wrong answers.
