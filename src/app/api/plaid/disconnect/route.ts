import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { plaid, decryptToken } from "@/lib/plaid/client"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { item_id } = await request.json()
  if (!item_id) return NextResponse.json({ error: "item_id required" }, { status: 400 })

  const admin = createAdminClient()

  // Verify ownership
  const { data: item } = await admin
    .from("plaid_items")
    .select("id, access_token")
    .eq("id", item_id)
    .eq("user_id", user.id)
    .single()

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Revoke at Plaid
  try {
    await plaid.itemRemove({ access_token: decryptToken(item.access_token) })
  } catch {
    // Continue even if Plaid revoke fails — still remove locally
  }

  // Delete from DB (cascades to plaid_accounts)
  await admin.from("plaid_items").delete().eq("id", item_id)

  return NextResponse.json({ success: true })
}
