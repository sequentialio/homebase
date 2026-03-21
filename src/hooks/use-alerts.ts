"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export interface Alert {
  id: string
  type: string
  title: string
  message: string
  severity: "info" | "warning" | "critical"
  is_read: boolean
  due_date: string | null
  expires_at: string | null
  created_at: string
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const fetchAlerts = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const now = new Date().toISOString()
    const { data } = await (supabase as any)
      .from("alerts")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_read", false)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("created_at", { ascending: false })
      .limit(20)

    setAlerts(data ?? [])
    setLoading(false)
  }, [supabase])

  const dismiss = useCallback(async (alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId))
    await (supabase as any)
      .from("alerts")
      .update({ is_read: true })
      .eq("id", alertId)
  }, [supabase])

  useEffect(() => {
    fetchAlerts()

    // Realtime subscription so bell updates when assistant creates alerts
    let channel: ReturnType<typeof supabase.channel> | null = null
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      channel = supabase
        .channel("alerts-realtime")
        .on(
          "postgres_changes" as any,
          { event: "*", schema: "public", table: "alerts", filter: `user_id=eq.${user.id}` },
          () => fetchAlerts()
        )
        .subscribe()
    })

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [supabase, fetchAlerts])

  return {
    alerts,
    unreadCount: alerts.length,
    loading,
    dismiss,
    refetch: fetchAlerts,
  }
}
