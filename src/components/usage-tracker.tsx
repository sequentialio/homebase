"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useMemo } from "react"

export function UsageTracker({ userId }: { userId: string }) {
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])
  const lastTrackedRef = useRef("")

  useEffect(() => {
    // Only log once per unique pathname visit
    if (pathname === lastTrackedRef.current) return
    lastTrackedRef.current = pathname

    // Map path to readable page name
    const page = pathname.split("/")[1] || "dashboard"

    ;(supabase as any)
      .from("usage_events")
      .insert({ user_id: userId, event_type: "page_view", page })
      .then(() => {}) // fire-and-forget, ignore errors
  }, [pathname, userId, supabase])

  return null
}
