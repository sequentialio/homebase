import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

export async function POST(request: Request) {
  try {
    // Rate limit: 10 invites per minute per IP
    const ip = getClientIp(request)
    const rl = await checkRateLimit(`${ip}:/api/admin/invite`, { limit: 10, windowSeconds: 60 })
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

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!callerProfile || callerProfile.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    // Parse request body
    let body: { email?: string; role?: string; office_id?: string; full_name?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }
    const { email, role, office_id, full_name } = body

    if (!email || !role) {
      return NextResponse.json(
        { error: "Email and role are required" },
        { status: 400 }
      )
    }

    // Server-side domain validation
    const allowedDomains = ["@rfmacdonald.com", "@sequentialanalytics.com", "@sequentialanalytics.io"]
    if (!allowedDomains.some((domain) => email.toLowerCase().endsWith(domain))) {
      return NextResponse.json(
        { error: "Only @rfmacdonald.com email addresses can be invited" },
        { status: 400 }
      )
    }

    const validRoles = ["field_sales", "inside_sales", "manager", "admin"]
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Generate an invite link (does NOT send an email — avoids spam filters)
    const { data: linkData, error: linkError } =
      await adminClient.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          data: {
            full_name: full_name || email.split("@")[0],
            role,
            office_id: office_id || null,
          },
        },
      })

    if (linkError) {
      console.error("Invite link error:", linkError.message)
      return NextResponse.json(
        { error: linkError.message || "Failed to generate invite link" },
        { status: 400 }
      )
    }

    // The profile should be created automatically by the auth trigger,
    // but update it with the correct role and office if needed
    if (linkData.user) {
      await adminClient
        .from("profiles")
        .update({
          role,
          office_id: office_id || null,
          full_name: full_name || email.split("@")[0],
        })
        .eq("id", linkData.user.id)
    }

    // Build the invite URL from the token properties
    const {
      properties: { hashed_token, verification_type },
    } = linkData

    // Build an invite link that goes to our app's accept page (client-side token exchange)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    const inviteLink = `${siteUrl}/invite/accept?token=${hashed_token}&type=${verification_type}`

    return NextResponse.json({
      success: true,
      user_id: linkData.user?.id,
      invite_link: inviteLink,
    })
  } catch (error) {
    console.error("Invite error:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to invite user" },
      { status: 500 }
    )
  }
}
