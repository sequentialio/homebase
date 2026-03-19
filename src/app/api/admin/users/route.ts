import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

export async function PATCH(request: Request) {
  // Rate limit: 30 user updates per minute per IP
  const ip = getClientIp(request)
  const rl = await checkRateLimit(`${ip}:/api/admin/users`, { limit: 30, windowSeconds: 60 })
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  // Verify the caller is an admin
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Verify role via admin client (bypasses RLS — reads actual DB value)
  const adminClient = createAdminClient()
  const { data: callerProfile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!callerProfile || callerProfile.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  // Parse request body
  let body: { user_id?: string; role?: string; office_id?: string; is_active?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const { user_id, role, office_id, is_active } = body

  if (!user_id) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 })
  }

  // Prevent admin from deactivating or demoting themselves
  if (user_id === user.id) {
    if (is_active === false) {
      return NextResponse.json(
        { error: "You cannot deactivate your own account" },
        { status: 403 }
      )
    }
    if (role && role !== "admin") {
      return NextResponse.json(
        { error: "You cannot change your own role" },
        { status: 403 }
      )
    }
  }

  if (role) {
    const validRoles = ["field_sales", "inside_sales", "manager", "admin"]
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }
  }

  try {
    // Build update payload — only include fields that were provided
    const updates: Record<string, unknown> = {}
    if (role !== undefined) updates.role = role
    if (office_id !== undefined) updates.office_id = office_id || null
    if (is_active !== undefined) updates.is_active = is_active

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const { error: updateError } = await adminClient
      .from("profiles")
      .update(updates)
      .eq("id", user_id)

    if (updateError) {
      console.error("[admin/users] Update error:", updateError.message)
      return NextResponse.json(
        { error: "Failed to update user" },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/users] Error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}
