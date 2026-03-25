import { createClient as createServerClient } from "@/lib/supabase/server"

interface AuditLogEntry {
  userId: string
  action: string
  targetTable?: string
  targetId?: string
  details?: Record<string, unknown>
  ipAddress?: string
}

/**
 * Insert an audit log entry for a privileged action.
 * Use the service role client to bypass RLS.
 *
 * @example
 * await insertAuditLog({
 *   userId: user.id,
 *   action: "oauth_token_stored",
 *   targetTable: "asana_connections",
 *   targetId: connectionId,
 *   details: { workspace_id: "12345", expires_at: "2026-03-31T10:00:00Z" }
 * })
 */
export async function insertAuditLog({
  userId,
  action,
  targetTable,
  targetId,
  details,
  ipAddress,
}: AuditLogEntry): Promise<void> {
  try {
    // Import service role client (bypasses RLS)
    const { createAdminClient } = await import("@/lib/supabase/admin")
    const adminClient = createAdminClient()

    const { error } = await adminClient
      .from("audit_log")
      .insert({
        user_id: userId,
        action,
        target_table: targetTable ?? null,
        target_id: targetId ?? null,
        details: details ?? null,
        ip_address: ipAddress ?? null,
      })

    if (error) {
      console.error("Failed to insert audit log:", error)
      // Don't throw — audit logging failures should not block the operation
    }
  } catch (error) {
    console.error("Audit logging error:", error instanceof Error ? error.message : error)
    // Silently fail — audit logging should not break the main operation
  }
}

/**
 * Get audit logs for the current user
 */
export async function getAuditLogs(limit = 50) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await (supabase as any)
    .from("audit_log")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("Failed to fetch audit logs:", error)
    return []
  }

  return data ?? []
}
