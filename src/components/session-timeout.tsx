"use client"

import { useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

const TIMEOUT_MS = 15 * 60 * 1000       // 15 minutes
const WARNING_MS = 13 * 60 * 1000       // 13 minutes (warn 2 min before)
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "pointerdown",
]

/**
 * Tracks user activity and signs out after 15 minutes of inactivity.
 * Shows a warning toast at 13 minutes. Resets on any user interaction.
 */
export function SessionTimeout() {
  const router = useRouter()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const warningRef = useRef<NodeJS.Timeout | null>(null)
  const warnedRef = useRef(false)

  const signOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }, [router])

  const resetTimers = useCallback(() => {
    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (warningRef.current) clearTimeout(warningRef.current)
    warnedRef.current = false

    // Warning at 13 minutes
    warningRef.current = setTimeout(() => {
      warnedRef.current = true
      toast.warning("Session expiring in 2 minutes", {
        description: "Move your mouse or press a key to stay signed in.",
        duration: 30_000,
      })
    }, WARNING_MS)

    // Sign out at 15 minutes
    timeoutRef.current = setTimeout(() => {
      toast.info("Signed out due to inactivity")
      signOut()
    }, TIMEOUT_MS)
  }, [signOut])

  useEffect(() => {
    // Initialize timers
    resetTimers()

    // Reset on activity
    function handleActivity() {
      resetTimers()
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true })
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (warningRef.current) clearTimeout(warningRef.current)
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity)
      }
    }
  }, [resetTimers])

  return null // Invisible component
}
