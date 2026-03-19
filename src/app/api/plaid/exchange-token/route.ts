import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { plaid, encryptToken } from "@/lib/plaid/client"
import { checkRateLimit } from "@/lib/rate-limit"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rl = await checkRateLimit(`${user.id}:/api/plaid/exchange-token`, { limit: 5, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const { public_token, institution } = await request.json()
  if (!public_token) return NextResponse.json({ error: "public_token required" }, { status: 400 })

  // Exchange public token for access token
  const exchangeRes = await plaid.itemPublicTokenExchange({ public_token })
  const { access_token, item_id } = exchangeRes.data

  // Fetch accounts for this item
  const accountsRes = await plaid.accountsGet({ access_token })
  const accounts = accountsRes.data.accounts

  const admin = createAdminClient()

  // Store item with encrypted access token
  const { data: item, error: itemError } = await admin
    .from("plaid_items")
    .insert({
      user_id: user.id,
      item_id,
      access_token: encryptToken(access_token),
      institution_id: institution?.institution_id ?? null,
      institution_name: institution?.name ?? null,
    })
    .select("id")
    .single()

  if (itemError) {
    console.error("plaid_items insert error:", itemError)
    return NextResponse.json({ error: "Failed to store item" }, { status: 500 })
  }

  // Store all accounts for this item
  const accountRows = accounts.map((a) => ({
    item_id: item.id,
    user_id: user.id,
    plaid_account_id: a.account_id,
    name: a.name,
    official_name: a.official_name ?? null,
    type: a.type,
    subtype: a.subtype ?? null,
    mask: a.mask ?? null,
    current_balance: a.balances.current ?? null,
    available_balance: a.balances.available ?? null,
    limit_balance: a.balances.limit ?? null,
    iso_currency_code: a.balances.iso_currency_code ?? "USD",
  }))

  const { error: accountsError } = await admin
    .from("plaid_accounts")
    .insert(accountRows)

  if (accountsError) {
    console.error("plaid_accounts insert error:", accountsError)
  }

  return NextResponse.json({
    success: true,
    institution_name: institution?.name,
    accounts_connected: accounts.length,
  })
}
