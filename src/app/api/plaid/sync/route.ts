/**
 * Plaid transaction sync — called by daily Vercel cron or manually.
 *
 * Cron: authenticated by CRON_SECRET header (set by Vercel automatically).
 * Manual: authenticated by user session (only syncs that user's items).
 *
 * Uses /transactions/sync with a stored cursor so each run only fetches
 * new/modified/removed transactions since the last sync.
 */
import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { plaid, decryptToken } from "@/lib/plaid/client"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

function safeCompare(a: string | null, b: string | undefined): boolean {
  if (!a || !b) return false
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

// Plaid: positive amount = money out (expense), negative = money in (income)
function mapTransaction(tx: {
  transaction_id: string
  account_id: string
  date: string
  name: string
  amount: number
  personal_finance_category?: { primary?: string } | null
}, userId: string) {
  return {
    user_id: userId,
    plaid_transaction_id: tx.transaction_id,
    plaid_account_id: tx.account_id,
    date: tx.date,
    description: tx.name,
    amount: Math.abs(tx.amount),
    type: tx.amount > 0 ? "expense" : "income",
    category: tx.personal_finance_category?.primary ?? null,
  }
}

async function syncItem(itemId: string, userId: string) {
  const admin = createAdminClient()

  const { data: item } = await admin
    .from("plaid_items")
    .select("id, access_token, cursor")
    .eq("id", itemId)
    .single()

  if (!item) return { added: 0, modified: 0, removed: 0 }

  const accessToken = decryptToken(item.access_token)
  let cursor = item.cursor ?? undefined
  let added = 0, modified = 0, removed = 0
  let hasMore = true

  while (hasMore) {
    const res = await plaid.transactionsSync({
      access_token: accessToken,
      cursor,
      options: { include_personal_finance_category: true },
    })
    const data = res.data

    // Insert new transactions (ignore duplicates via ON CONFLICT)
    if (data.added.length > 0) {
      const rows = data.added.map((tx) => mapTransaction(tx as Parameters<typeof mapTransaction>[0], userId))
      await admin
        .from("transactions")
        .upsert(rows, { onConflict: "plaid_transaction_id", ignoreDuplicates: true })
      added += data.added.length
    }

    // Update modified transactions
    for (const tx of data.modified) {
      const mapped = mapTransaction(tx as Parameters<typeof mapTransaction>[0], userId)
      await admin
        .from("transactions")
        .update(mapped)
        .eq("plaid_transaction_id", tx.transaction_id)
      modified++
    }

    // Remove deleted transactions
    for (const tx of data.removed) {
      if (tx.transaction_id) {
        await admin
          .from("transactions")
          .delete()
          .eq("plaid_transaction_id", tx.transaction_id)
        removed++
      }
    }

    cursor = data.next_cursor
    hasMore = data.has_more
  }

  // Save updated cursor and last_synced_at
  await admin
    .from("plaid_items")
    .update({ cursor, last_synced_at: new Date().toISOString() })
    .eq("id", itemId)

  // Refresh account balances
  try {
    const accountsRes = await plaid.accountsGet({ access_token: accessToken })
    for (const acct of accountsRes.data.accounts) {
      await admin
        .from("plaid_accounts")
        .update({
          current_balance: acct.balances.current ?? null,
          available_balance: acct.balances.available ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("plaid_account_id", acct.account_id)
    }
  } catch {
    // Balance refresh is best-effort
  }

  return { added, modified, removed }
}

export async function POST(request: Request) {
  // Cron path: verify CRON_SECRET (timing-safe)
  const cronSecret = request.headers.get("x-cron-secret")
  const isCron = safeCompare(cronSecret, process.env.CRON_SECRET)

  let userId: string | null = null

  if (isCron) {
    // Sync ALL items for ALL users
    const admin = createAdminClient()
    const { data: items } = await admin.from("plaid_items").select("id, user_id")
    if (!items?.length) return NextResponse.json({ synced: 0 })

    const results = await Promise.allSettled(
      items.map((item) => syncItem(item.id, item.user_id))
    )

    const totals = results.reduce(
      (acc, r) => {
        if (r.status === "fulfilled") {
          acc.added += r.value.added
          acc.modified += r.value.modified
          acc.removed += r.value.removed
        }
        return acc
      },
      { added: 0, modified: 0, removed: 0 }
    )

    return NextResponse.json({ synced: items.length, ...totals })
  }

  // Manual path: authenticated user, sync only their items
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rl = await checkRateLimit(`${getClientIp(request)}:/api/plaid/sync`, { limit: 5, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  userId = user.id

  const admin = createAdminClient()
  const { data: items } = await admin
    .from("plaid_items")
    .select("id")
    .eq("user_id", userId)

  if (!items?.length) return NextResponse.json({ message: "No connected banks", synced: 0 })

  const results = await Promise.allSettled(
    items.map((item) => syncItem(item.id, userId!))
  )

  const totals = results.reduce(
    (acc, r) => {
      if (r.status === "fulfilled") {
        acc.added += r.value.added
        acc.modified += r.value.modified
        acc.removed += r.value.removed
      }
      return acc
    },
    { added: 0, modified: 0, removed: 0 }
  )

  return NextResponse.json({ synced: items.length, ...totals })
}
