import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

/**
 * Generic State Transition API Route
 *
 * The most important security pattern in any workflow app.
 * Copy this file for every privileged status change in your app.
 *
 * SETUP — find and replace before using:
 *   1. "entities"   → your table name (e.g. "orders", "requests", "tickets")
 *   2. "entity"     → your singular noun  (e.g. "order", "request")
 *   3. ALLOWED_ROLES → roles that can trigger transitions
 *   4. VALID_TRANSITIONS → your state machine (from → allowed tos)
 *   5. revalidatePath() calls → your affected routes
 *   6. Edge function invoke → your notification function name
 *
 * WHAT THIS PATTERN ENFORCES (the full security checklist):
 *   ✓ Rate limiting per IP
 *   ✓ Authentication required
 *   ✓ Role-based authorization (server-enforced, never trust the client)
 *   ✓ Self-action prevention (can't approve your own submission)
 *   ✓ Valid state machine transitions (can't skip states or go backwards)
 *   ✓ Record existence check before update
 *   ✓ Fire-and-forget notification (never blocks the response)
 *   ✓ Cache revalidation after state change
 *
 * POST /api/entities/[id]/transition
 * Body: { action: "approve" | "reject", notes?: string }
 */

// ── Config ────────────────────────────────────────────────────────

const TABLE = "entities"
const ENTITY_LABEL = "entity"

/** Roles allowed to perform transitions */
const ALLOWED_ROLES = ["manager", "admin"]

/** State machine: current status → allowed next statuses per action */
const VALID_TRANSITIONS: Record<string, Record<string, string>> = {
  submitted:  { approve: "approved", reject: "rejected" },
  in_review:  { approve: "approved", reject: "rejected" },
  // Add more states as needed:
  // approved: { archive: "archived" },
}

/** Actions that require notes */
const REQUIRES_NOTES = ["reject"]

/** Edge function to notify on transition (optional — safe to leave as-is if not deployed) */
const NOTIFY_FUNCTION = "notify-transition"

// ── Handler ───────────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: entityId } = await params

  // 1. Rate limit
  const ip = getClientIp(request)
  const rl = await checkRateLimit(`${ip}:/api/${TABLE}/transition`, { limit: 20, windowSeconds: 60 })
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const supabase = await createClient()

  // 2. Auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 3. Role check
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return NextResponse.json(
      { error: `Only ${ALLOWED_ROLES.join(" or ")} can perform this action` },
      { status: 403 }
    )
  }

  // 4. Parse body
  let body: { action?: string; notes?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { action, notes } = body
  if (!action) {
    return NextResponse.json({ error: "action is required" }, { status: 400 })
  }

  if (REQUIRES_NOTES.includes(action) && !notes?.trim()) {
    return NextResponse.json(
      { error: `Notes are required when action is "${action}"` },
      { status: 400 }
    )
  }

  // 5. Fetch record
  const { data: record } = await supabase
    .from(TABLE)
    .select("id, status, created_by")
    .eq("id", entityId)
    .single()

  if (!record) {
    return NextResponse.json({ error: `${ENTITY_LABEL} not found` }, { status: 404 })
  }

  // 6. Validate transition
  const allowedForStatus = VALID_TRANSITIONS[record.status]
  if (!allowedForStatus || !allowedForStatus[action]) {
    return NextResponse.json(
      { error: `Cannot perform "${action}" on a ${ENTITY_LABEL} with status "${record.status}"` },
      { status: 400 }
    )
  }

  const newStatus = allowedForStatus[action]

  // 7. Self-action prevention
  if (record.created_by === user.id) {
    return NextResponse.json(
      { error: `You cannot ${action} your own ${ENTITY_LABEL}` },
      { status: 403 }
    )
  }

  // 8. Apply transition
  const { error: updateError } = await supabase
    .from(TABLE)
    .update({
      status: newStatus,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: notes?.trim() ?? null,
    })
    .eq("id", entityId)

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to ${action} ${ENTITY_LABEL}` },
      { status: 500 }
    )
  }

  // 9. Revalidate cache
  revalidatePath("/dashboard")
  revalidatePath(`/${TABLE}`)

  // 10. Fire-and-forget notification
  try {
    supabase.functions
      .invoke(NOTIFY_FUNCTION, {
        body: { entity_id: entityId, action: newStatus, notes: notes ?? null },
      })
      .catch(() => {})
  } catch {
    // Ignore — notification is non-blocking
  }

  return NextResponse.json({ success: true, status: newStatus })
}
