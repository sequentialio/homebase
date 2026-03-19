import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { plaid } from "@/lib/plaid/client"
import { Products, CountryCode } from "plaid"

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const response = await plaid.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: "Mita",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    })
    return NextResponse.json({ link_token: response.data.link_token })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[plaid/create-link-token]", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
